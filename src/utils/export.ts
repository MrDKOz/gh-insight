import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import { MS_PER_DAY, fmtDate } from "./dateUtils";
import { itemEndDate, itemStatus } from "./displayUtils";

const safeFilename = (s: string): string =>
  s
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const triggerBlobDownload = (content: string, filename: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
};

type Row = {
  kind: string;
  type: string;
  num: string;
  title: string;
  author: string;
  assignees: string;
  labels: string;
  status: string;
  draft: string;
  reopened: string;
  reviewState: string;
  size: string;
  opened: string;
  closed: string;
  duration: string;
  linked: string;
  url: string;
};

const buildRows = (items: TimelineItem[], milestones: MilestoneMeta[] = []): Row[] => {
  const msKind = new Map(milestones.map((m) => [m.number, m.kind]));
  return [...items]
    .sort((a, b) => a.number - b.number)
    .map((item) => {
      const endDate = itemEndDate(item);
      const status = itemStatus(item);
      const days =
        endDate != null
          ? Math.max(0, Math.round((new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS_PER_DAY))
          : null;
      const linked =
        item.type === "pr"
          ? item.linkedIssue != null ? `Issue #${item.linkedIssue}` : "—"
          : item.linkedPRs.length > 0
            ? item.linkedPRs.map((n) => `PR #${n}`).join(", ")
            : "—";
      const draft = item.type === "pr" && item.isDraft ? "Draft" : "";
      const reopened = item.type === "issue" && item.reopenedCount > 0 ? String(item.reopenedCount) : "—";
      const reviewState =
        item.type === "pr"
          ? item.reviewDecision === "APPROVED" ? "Approved"
          : item.reviewDecision === "CHANGES_REQUESTED" ? "Changes Requested"
          : item.reviewDecision === "REVIEW_REQUIRED" ? "Review Required"
          : "—"
          : "—";
      const size = item.type === "pr" ? `+${item.additions} / -${item.deletions}` : "—";
      const rawKind = msKind.get(item.milestoneNumber);
      const kind = rawKind === "epic" ? "Epic" : "Milestone";
      return {
        kind,
        type: item.type === "issue" ? "Issue" : "PR",
        num: `#${item.number}`,
        title: item.title,
        author: item.author,
        assignees: item.assignees.join(", ") || "—",
        labels: item.labels.map((l) => l.name).join(", ") || "—",
        status,
        draft,
        reopened,
        reviewState,
        size,
        opened: fmtDate(item.createdAt, true),
        closed: fmtDate(endDate, true),
        duration: days != null ? String(days) : "—",
        linked,
        url: item.url,
      };
    });
};

const COLS = ["Source Type", "Type", "Number", "Title", "Author", "Assignees", "Labels", "Status", "Draft", "Reopened", "Review State", "Size (+/-)", "Opened", "Closed/Merged", "Duration (days)", "Linked to", "URL"] as const;

const exportCSV = (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): void => {
  const rows = buildRows(items, milestones);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    COLS.map(esc).join(","),
    ...rows.map((r) =>
      [r.kind, r.type, r.num, r.title, r.author, r.assignees, r.labels, r.status, r.draft, r.reopened, r.reviewState, r.size, r.opened, r.closed, r.duration, r.linked, r.url].map(esc).join(","),
    ),
  ];
  triggerBlobDownload(lines.join("\r\n"), `${safeFilename(title)}.csv`, "text/csv;charset=utf-8;");
};

const exportMarkdown = (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): void => {
  const rows = buildRows(items, milestones);
  const pipe = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `# ${title}`,
    "",
    "| Source Type | Type | # | Title | Author | Assignees | Labels | Status | Draft | Reopened | Review State | Size (+/-) | Opened | Closed/Merged | Duration | Linked to |",
    "|-------------|------|---|-------|--------|-----------|--------|--------|-------|----------|--------------|------------|--------|---------------|----------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.kind} | ${r.type} | [${r.num}](${r.url}) | ${pipe(r.title)} | ${r.author} | ${r.assignees} | ${pipe(r.labels)} | ${r.status} | ${r.draft} | ${r.reopened} | ${r.reviewState} | ${r.size} | ${r.opened} | ${r.closed} | ${r.duration === "—" ? "—" : `${r.duration} days`} | ${r.linked} |`,
    ),
  ];
  triggerBlobDownload(lines.join("\n"), `${safeFilename(title)}.md`, "text/markdown;charset=utf-8;");
};

// Transparent 1×1 PNG — fallback for CORS-blocked images (e.g. GitHub avatars)
// inside html-to-image's cloned document.
const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const htmlToImageOpts = (overrides?: { width?: number; height?: number }) => ({
  pixelRatio: 2,
  skipFonts: true,
  imagePlaceholder: TRANSPARENT_PNG,
  ...overrides,
  filter: (node: Node) => !(node instanceof Element && node.hasAttribute("data-export-exclude")),
});

// Pre-fetch all <img> tags in el and swap their src to data URLs so html-to-image
// can inline them. GitHub avatars support CORS (Access-Control-Allow-Origin: *) but
// html-to-image's cloned document can't re-fetch cross-origin images, causing the
// MUI Avatar fallback (coloured circle) to render instead of the actual avatar.
// Returns a restore function that puts the original src values back.
const inlineImages = async (el: HTMLElement): Promise<() => void> => {
  const imgs = Array.from(el.querySelectorAll<HTMLImageElement>("img[src]"));
  const originals = new Map<HTMLImageElement, string>();

  await Promise.allSettled(imgs.map(async (img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) {return;}
    try {
      const response = await fetch(src, { mode: "cors" });
      if (!response.ok) {return;}
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      originals.set(img, src);
      img.src = dataUrl;
    } catch {
      // CORS fetch failed — leave as-is; html-to-image will use imagePlaceholder
    }
  }));

  return () => { originals.forEach((src, img) => { img.src = src; }); };
};

// Capture an element as a PNG data URL. Two-pass to force Emotion styles to inline.
const captureElement = async (el: HTMLElement, overrides?: { width?: number; height?: number }): Promise<string> => {
  const { toPng } = await import("html-to-image");
  const opts = htmlToImageOpts(overrides);
  const restore = await inlineImages(el);
  try {
    await toPng(el, opts).catch((err) => { console.error("html-to-image warm-up pass failed:", err); }); // warm-up
    return await toPng(el, opts);
  } finally {
    restore();
  }
};

// Crop a full-timeline Gantt image to the currently-visible viewport:
// label column (left, non-scrolling) + the visible slice of the track column.
// fullDataUrl must have been captured at pixelRatio 2 (as htmlToImageOpts sets).
const cropGanttToCurrentView = async (
  fullDataUrl: string,
  labelColWidth: number,
  trackClientWidth: number,
  scrollLeft: number,
): Promise<string> => {
  const pr = 2; // must match htmlToImageOpts pixelRatio
  const img = new Image();
  img.src = fullDataUrl;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });

  const outW = Math.round((labelColWidth + trackClientWidth) * pr);
  const outH = img.height;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  const labelPx = Math.round(labelColWidth * pr);
  const trackPx = Math.round(trackClientWidth * pr);
  const srcTrackX = Math.round((labelColWidth + scrollLeft) * pr);

  // Label column — always at x=0 in the full image
  ctx.drawImage(img, 0, 0, labelPx, outH, 0, 0, labelPx, outH);
  // Visible portion of the track column
  ctx.drawImage(img, srcTrackX, 0, trackPx, outH, labelPx, 0, trackPx, outH);

  return canvas.toDataURL("image/png");
};

// Temporarily expands the Gantt track column to its full scroll width, calls fn with
// the resulting capture dimensions, then restores original styles — used by both
// PNG full-timeline and Gantt PDF exports to avoid duplicating expand/restore logic.
const withExpandedGantt = async <T>(
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  captureCallback: (size: { width: number; height: number }) => Promise<T>,
): Promise<T> => {
  let prevTrackOverflowX = "";
  let prevTrackWidth = "";
  let prevWrapperWidth = "";

  if (trackColEl) {
    prevTrackOverflowX = trackColEl.style.overflowX;
    prevTrackWidth = trackColEl.style.width;
    prevWrapperWidth = wrapperEl.style.width;
    trackColEl.style.overflowX = "visible";
    trackColEl.style.width = `${trackColEl.scrollWidth}px`;
    wrapperEl.style.width = `${wrapperEl.scrollWidth}px`;
  }
  const width = wrapperEl.scrollWidth;
  const height = wrapperEl.scrollHeight;
  try {
    return await captureCallback({ width, height });
  } finally {
    if (trackColEl) {
      trackColEl.style.overflowX = prevTrackOverflowX;
      trackColEl.style.width = prevTrackWidth;
      wrapperEl.style.width = prevWrapperWidth;
    }
  }
};

const exportPNG = async (
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  title: string,
  mode: "current" | "full",
): Promise<void> => {
  const download = (dataUrl: string, suffix: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeFilename(title)}_${suffix}.png`;
    a.click();
  };

  if (mode === "full") {
    await withExpandedGantt(wrapperEl, trackColEl, async ({ width, height }) => {
      download(await captureElement(wrapperEl, { width, height }), "full");
    });
  } else if (trackColEl) {
    // Gantt current view: read viewport geometry before expanding, capture the full
    // timeline image, then crop it down to what the user currently sees.
    const scrollLeft = trackColEl.scrollLeft;
    const trackClientWidth = trackColEl.clientWidth;
    const labelColWidth = wrapperEl.clientWidth - trackColEl.clientWidth;
    const fullDataUrl = await withExpandedGantt(wrapperEl, trackColEl, async ({ width, height }) =>
      captureElement(wrapperEl, { width, height }),
    );
    download(await cropGanttToCurrentView(fullDataUrl, labelColWidth, trackClientWidth, scrollLeft), "current");
  } else {
    download(await captureElement(wrapperEl), "current");
  }
};

// Embed an image data URL into a landscape A4 PDF, scaled to fit with a title header.
const embedImageInPDF = async (dataUrl: string, title: string, filename: string): Promise<void> => {
  const { jsPDF } = await import("jspdf");

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });
  // Captured at pixelRatio 2, so divide by 2 for CSS px → mm scaling
  const imgCssW = img.width / 2;
  const imgCssH = img.height / 2;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 14;
  const titleH = 12;
  const availW = doc.internal.pageSize.getWidth() - margin * 2;
  const availH = doc.internal.pageSize.getHeight() - margin - titleH - margin;

  const scale = Math.min(availW / imgCssW, availH / imgCssH);
  doc.setFontSize(14);
  doc.setTextColor(36, 47, 47);
  doc.text(title, margin, margin + 6);
  doc.addImage(dataUrl, "PNG", margin, margin + titleH, imgCssW * scale, imgCssH * scale);
  doc.save(filename);
};

// Chart views: capture the current viewport and embed as an image in a PDF.
const exportChartPDF = async (wrapperEl: HTMLElement, title: string): Promise<void> => {
  await embedImageInPDF(await captureElement(wrapperEl), title, `${safeFilename(title)}_chart.pdf`);
};

// Gantt: expand to full scroll width, capture, then embed in a landscape A4 PDF.
const exportGanttPDF = async (
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  title: string,
): Promise<void> => {
  await withExpandedGantt(wrapperEl, trackColEl, async ({ width, height }) => {
    await embedImageInPDF(
      await captureElement(wrapperEl, { width, height }),
      title,
      `${safeFilename(title)}_gantt.pdf`,
    );
  });
};

// Chart views: extract the SVG element directly for a clean, scalable vector file.
// The charts use hardcoded presentation attributes (fill, stroke) so the exported SVG
// renders correctly in any vector tool or browser without the page's CSS.
const exportSVG = (wrapperEl: HTMLElement, title: string): void => {
  const svgEl = wrapperEl.querySelector<SVGSVGElement>('svg[aria-hidden="true"]');
  if (!svgEl) { return; }

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Replace width: 100% / height: auto with explicit pixel dimensions from the
  // viewBox so the file has natural dimensions when opened standalone.
  const vb = clone.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/\s+/);
    if (parts[2]) { clone.setAttribute("width", parts[2]); }
    if (parts[3]) { clone.setAttribute("height", parts[3]); }
  }
  clone.removeAttribute("style");

  // Set a concrete font-family so text using fontFamily="inherit" renders
  // with a reasonable font when the SVG is opened outside the browser page.
  clone.setAttribute("font-family", "redgate-type, sans-serif");

  triggerBlobDownload(
    new XMLSerializer().serializeToString(clone),
    `${safeFilename(title)}.svg`,
    "image/svg+xml;charset=utf-8;",
  );
};

// Minimal jsPDF surface needed by drawPDFTable — avoids importing the full type.
type PdfDoc = {
  setFillColor(r: number, g: number, b: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setFont(name: string, style: string): unknown;
  setFontSize(size: number): unknown;
  rect(x: number, y: number, w: number, h: number, style: string): unknown;
  text(text: string, x: number, y: number): unknown;
  link(x: number, y: number, w: number, h: number, options: { url: string }): unknown;
  addPage(): unknown;
  splitTextToSize(text: string, maxWidth: number): string[];
  internal: { pageSize: { getHeight(): number } };
};

type PdfColDef = { label: string; width: number };

// Draws a styled table into a jsPDF document without any third-party plugins.
// Repeats the header on each new page and adds a hyperlink on linkColIdx.
const drawPDFTable = (
  doc: PdfDoc,
  startY: number,
  cols: PdfColDef[],
  rows: string[][],
  getUrl: (rowIdx: number) => string | undefined,
  linkColIdx: number,
): void => {
  const MARGIN = 14;
  const ROW_H = 7;
  const PAD_X = 2;
  const BASE_Y = 5; // text baseline offset from row top (mm)
  const FS = 8;
  const BOTTOM_MARGIN = 10;
  const tableW = cols.reduce((sum, c) => sum + c.width, 0);
  const pageH = doc.internal.pageSize.getHeight();

  const drawHeader = (atY: number): void => {
    doc.setFillColor(9, 105, 218);
    doc.rect(MARGIN, atY, tableW, ROW_H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FS);
    let x = MARGIN;
    for (const col of cols) {
      const label = doc.splitTextToSize(col.label, col.width - PAD_X * 2)[0] ?? "";
      doc.text(label, x + PAD_X, atY + BASE_Y);
      x += col.width;
    }
  };

  let y = startY;
  drawHeader(y);
  y += ROW_H;

  doc.setFont("helvetica", "normal");
  for (const [i, row] of rows.entries()) {
    if (y + ROW_H > pageH - BOTTOM_MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawHeader(y);
      y += ROW_H;
      doc.setFont("helvetica", "normal");
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(MARGIN, y, tableW, ROW_H, "F");
    }
    doc.setTextColor(36, 41, 47);
    let x = MARGIN;
    for (const [j, col] of cols.entries()) {
      const cell = doc.splitTextToSize(row[j] ?? "", col.width - PAD_X * 2)[0] ?? "";
      doc.text(cell, x + PAD_X, y + BASE_Y);
      if (j === linkColIdx) {
        const url = getUrl(i);
        if (url) { doc.link(x, y, col.width, ROW_H, { url }); }
      }
      x += col.width;
    }
    y += ROW_H;
  }
};

const exportPDF = async (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): Promise<void> => {
  const { jsPDF } = await import("jspdf");
  const rows = buildRows(items, milestones);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(36, 41, 47);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(87, 96, 106);
  doc.text(
    `Generated ${fmtDate(new Date().toISOString(), true)}  ·  ${rows.length} item${rows.length !== 1 ? "s" : ""}`,
    14,
    25,
  );

  // Available width: 297 (A4 landscape) − 14 (left) − 14 (right) = 269 mm
  // SrcType(13)+Type(12)+#(13)+Title(44)+Author(17)+Assignees(15)+Labels(14)+Status(16)+Draft(9)+Reopened(9)+ReviewState(19)+Opened(20)+Closed(20)+Days(11)+Linked(17)+Size(20) = 269
  drawPDFTable(
    doc,
    30,
    [
      { label: "Source Type",   width: 13  },
      { label: "Type",          width: 12  },
      { label: "#",             width: 13  },
      { label: "Title",         width: 44  },
      { label: "Author",        width: 17  },
      { label: "Assignees",     width: 15  },
      { label: "Labels",        width: 14  },
      { label: "Status",        width: 16  },
      { label: "Draft",         width: 9   },
      { label: "Reopened",      width: 9   },
      { label: "Review State",  width: 19  },
      { label: "Opened",        width: 20  },
      { label: "Closed/Merged", width: 20  },
      { label: "Days",          width: 11  },
      { label: "Linked to",     width: 17  },
      { label: "Size (+/-)",    width: 20  },
    ],
    rows.map((r) => [r.kind, r.type, r.num, r.title, r.author, r.assignees, r.labels, r.status, r.draft, r.reopened, r.reviewState, r.opened, r.closed, r.duration, r.linked, r.size]),
    (i) => rows[i]?.url,
    2, // "#" column carries the hyperlink
  );

  doc.save(`${safeFilename(title)}.pdf`);
};

const exportXLSX = async (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): Promise<void> => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const rows = buildRows(items, milestones);

  const HEADER = {
    fontWeight: "bold" as const,
    backgroundColor: "#0969DA",
    color: "#FFFFFF",
  };

  const headerRow = COLS.map((value) => ({ value, ...HEADER }));

  const dataRows = rows.map((r) => [
    { value: r.kind },
    { value: r.type },
    { value: r.num },
    { value: r.title },
    { value: r.author },
    { value: r.assignees },
    { value: r.labels },
    { value: r.status },
    { value: r.draft },
    { value: r.reopened },
    { value: r.reviewState },
    { value: r.size },
    { value: r.opened },
    { value: r.closed },
    { value: r.duration },
    { value: r.linked },
    { value: r.url },
  ]);

  await writeXlsxFile([headerRow, ...dataRows], {
    columns: [
      { width: 12 },
      { width: 8 },
      { width: 10 },
      { width: 52 },
      { width: 18 },
      { width: 20 },
      { width: 24 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 20 },
      { width: 44 },
    ],
    fileName: `${safeFilename(title)}.xlsx`,
  });
};

// ── Review Wait exports ────────────────────────────────────────────────────
// These mirror the columns visible in the ReviewWaitList component:
// #, Title, Author, Status, Created, First Review, Wait (days), Total (days)

type ReviewWaitRow = {
  kind: string;
  num: string;
  milestone: string;
  title: string;
  author: string;
  assignees: string;
  labels: string;
  status: string;
  draft: string;
  created: string;
  firstReview: string;
  waitDays: string;
  totalDays: string;
  size: string;
  url: string;
};

const RW_COLS = ["Source Type", "#", "Milestone", "Title", "Author", "Assignees", "Labels", "Status", "Draft", "Created", "First Review", "Wait (days)", "Total (days)", "Size (+/-)", "URL"] as const;

const buildReviewWaitRows = (items: TimelineItem[], milestones: MilestoneMeta[] = []): ReviewWaitRow[] => {
  const msTitle = new Map(milestones.map((m) => [m.number, m.title]));
  const msKind  = new Map(milestones.map((m) => [m.number, m.kind]));
  return items
    .filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr")
    .map((pr) => {
      const createdMs = new Date(pr.createdAt).getTime();
      const endMs = pr.mergedAt
        ? new Date(pr.mergedAt).getTime()
        : pr.closedAt ? new Date(pr.closedAt).getTime() : null;
      const reviewMs = pr.firstReviewAt ? new Date(pr.firstReviewAt).getTime() : null;
      const waitDays = reviewMs !== null ? Math.max(0, Math.round((reviewMs - createdMs) / MS_PER_DAY)) : null;
      const totalDays = endMs !== null ? Math.max(0, Math.round((endMs - createdMs) / MS_PER_DAY)) : null;
      const status = itemStatus(pr);
      const rawKind = msKind.get(pr.milestoneNumber);
      const kind = rawKind === "epic" ? "Epic" : "Milestone";
      return {
        kind,
        num: `#${pr.number}`,
        milestone: msTitle.get(pr.milestoneNumber) ?? String(pr.milestoneNumber),
        title: pr.title,
        author: pr.author,
        assignees: pr.assignees.join(", ") || "—",
        labels: pr.labels.map((l) => l.name).join(", ") || "—",
        status,
        draft: pr.isDraft ? "Draft" : "",
        created: fmtDate(pr.createdAt, true),
        firstReview: pr.firstReviewAt ? fmtDate(pr.firstReviewAt, true) : "—",
        waitDays: waitDays !== null ? String(waitDays) : "—",
        totalDays: totalDays !== null ? String(totalDays) : "open",
        size: `+${pr.additions} / -${pr.deletions}`,
        url: pr.url,
      };
    })
    .sort((a, b) => {
      const wa = a.waitDays === "—" ? -1 : Number(a.waitDays);
      const wb = b.waitDays === "—" ? -1 : Number(b.waitDays);
      return wb - wa; // descending wait, matching default sort in the component
    });
};

const exportReviewWaitCSV = (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): void => {
  const rows = buildReviewWaitRows(items, milestones);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    RW_COLS.map(esc).join(","),
    ...rows.map((r) =>
      [r.kind, r.num, r.milestone, r.title, r.author, r.assignees, r.labels, r.status, r.draft, r.created, r.firstReview, r.waitDays, r.totalDays, r.size, r.url].map(esc).join(","),
    ),
  ];
  triggerBlobDownload(lines.join("\r\n"), `${safeFilename(title)}_review_wait.csv`, "text/csv;charset=utf-8;");
};

const exportReviewWaitMarkdown = (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): void => {
  const rows = buildReviewWaitRows(items, milestones);
  const pipe = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `# ${title} — Review Wait`,
    "",
    "| Source Type | # | Milestone | Title | Author | Assignees | Labels | Status | Draft | Created | First Review | Wait (days) | Total (days) | Size (+/-) |",
    "|-------------|---|-----------|-------|--------|-----------|--------|--------|-------|---------|--------------|-------------|--------------|------------|",
    ...rows.map(
      (r) => `| ${r.kind} | [${r.num}](${r.url}) | ${r.milestone} | ${pipe(r.title)} | ${r.author} | ${r.assignees} | ${pipe(r.labels)} | ${r.status} | ${r.draft} | ${r.created} | ${r.firstReview} | ${r.waitDays} | ${r.totalDays} | ${r.size} |`,
    ),
  ];
  triggerBlobDownload(lines.join("\n"), `${safeFilename(title)}_review_wait.md`, "text/markdown;charset=utf-8;");
};

const exportReviewWaitXLSX = async (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): Promise<void> => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const rows = buildReviewWaitRows(items, milestones);
  const HEADER = { fontWeight: "bold" as const, backgroundColor: "#0969DA", color: "#FFFFFF" };
  const headerRow = RW_COLS.map((value) => ({ value, ...HEADER }));
  const dataRows = rows.map((r) => [
    { value: r.kind },
    { value: r.num },
    { value: r.milestone },
    { value: r.title },
    { value: r.author },
    { value: r.assignees },
    { value: r.labels },
    { value: r.status },
    { value: r.draft },
    { value: r.created },
    { value: r.firstReview },
    { value: r.waitDays },
    { value: r.totalDays },
    { value: r.size },
    { value: r.url },
  ]);
  await writeXlsxFile([headerRow, ...dataRows], {
    columns: [{ width: 12 }, { width: 8 }, { width: 20 }, { width: 52 }, { width: 18 }, { width: 20 }, { width: 24 }, { width: 10 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 44 }],
    fileName: `${safeFilename(title)}_review_wait.xlsx`,
  });
};

const exportReviewWaitPDF = async (items: TimelineItem[], title: string, milestones: MilestoneMeta[] = []): Promise<void> => {
  const { jsPDF } = await import("jspdf");
  const rows = buildReviewWaitRows(items, milestones);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(36, 47, 47);
  doc.text(`${title} — Review Wait`, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(87, 96, 106);
  doc.text(`Generated ${fmtDate(new Date().toISOString(), true)}  ·  ${rows.length} PR${rows.length !== 1 ? "s" : ""}`, 14, 25);

  // Available width: 297 (A4 landscape) − 14 (left) − 14 (right) = 269 mm
  // SrcType(13)+#(13)+Milestone(19)+Title(55)+Author(20)+Assignees(18)+Labels(14)+Status(15)+Draft(9)+Created(20)+FirstReview(20)+Wait(14)+Total(14)+Size(15) = 269
  drawPDFTable(
    doc,
    30,
    [
      { label: "Source Type",  width: 13  },
      { label: "#",            width: 13  },
      { label: "Milestone",    width: 19  },
      { label: "Title",        width: 55  },
      { label: "Author",       width: 20  },
      { label: "Assignees",    width: 18  },
      { label: "Labels",       width: 14  },
      { label: "Status",       width: 15  },
      { label: "Draft",        width: 9   },
      { label: "Created",      width: 20  },
      { label: "First Review", width: 20  },
      { label: "Wait (d)",     width: 14  },
      { label: "Total (d)",    width: 14  },
      { label: "Size (+/-)",   width: 15  },
    ],
    rows.map((r) => [r.kind, r.num, r.milestone, r.title, r.author, r.assignees, r.labels, r.status, r.draft, r.created, r.firstReview, r.waitDays, r.totalDays, r.size]),
    (i) => rows[i]?.url,
    1, // "#" column carries the hyperlink
  );

  doc.save(`${safeFilename(title)}_review_wait.pdf`);
};

export { buildReviewWaitRows, buildRows, exportCSV, exportChartPDF, exportGanttPDF, exportMarkdown, exportPDF, exportPNG, exportReviewWaitCSV, exportReviewWaitMarkdown, exportReviewWaitPDF, exportReviewWaitXLSX, exportSVG, exportXLSX, safeFilename };

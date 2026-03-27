import type { TimelineItem } from "../types";
import { MS, fmtDate, itemEndDate } from "./utils";

const safeFilename = (s: string): string =>
  s
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

const triggerBlobDownload = (content: string, filename: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

type Row = {
  type: string;
  num: string;
  title: string;
  author: string;
  status: string;
  opened: string;
  closed: string;
  duration: string;
  linked: string;
  url: string;
};

const buildRows = (items: TimelineItem[]): Row[] =>
  [...items]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => {
      const endDate = itemEndDate(item);
      const status = item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
      const days =
        endDate != null
          ? Math.round((new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS)
          : null;
      const linked =
        item.type === "pr"
          ? item.linkedIssue != null ? `Issue #${item.linkedIssue}` : "—"
          : item.linkedPRs.length > 0
            ? item.linkedPRs.map((n) => `PR #${n}`).join(", ")
            : "—";
      return {
        type: item.type === "issue" ? "Issue" : "PR",
        num: `#${item.number}`,
        title: item.title,
        author: item.author,
        status,
        opened: fmtDate(item.createdAt, true),
        closed: fmtDate(endDate, true),
        duration: days != null ? String(days) : "—",
        linked,
        url: item.url,
      };
    });

const COLS = ["Type", "Number", "Title", "Author", "Status", "Opened", "Closed/Merged", "Duration (days)", "Linked to", "URL"] as const;

const exportCSV = (items: TimelineItem[], title: string): void => {
  const rows = buildRows(items);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    COLS.map(esc).join(","),
    ...rows.map((r) =>
      [r.type, r.num, r.title, r.author, r.status, r.opened, r.closed, r.duration, r.linked, r.url].map(esc).join(","),
    ),
  ];
  triggerBlobDownload(lines.join("\r\n"), `${safeFilename(title)}.csv`, "text/csv;charset=utf-8;");
};

const exportMarkdown = (items: TimelineItem[], title: string): void => {
  const rows = buildRows(items);
  const pipe = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `# ${title}`,
    "",
    "| Type | # | Title | Author | Status | Opened | Closed/Merged | Duration | Linked to |",
    "|------|---|-------|--------|--------|--------|---------------|----------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.type} | [${r.num}](${r.url}) | ${pipe(r.title)} | ${r.author} | ${r.status} | ${r.opened} | ${r.closed} | ${r.duration === "—" ? "—" : `${r.duration} days`} | ${r.linked} |`,
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
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) {return;}
      const blob = await res.blob();
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
    await toPng(el, opts).catch(() => {}); // warm-up
    return await toPng(el, opts);
  } finally {
    restore();
  }
};

const exportPNG = async (
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  title: string,
  mode: "current" | "full",
): Promise<void> => {
  let prevTrackOverflowX = "";
  let prevTrackWidth = "";
  let prevWrapperWidth = "";
  let captureWidth: number | undefined;
  let captureHeight: number | undefined;

  if (mode === "full" && trackColEl) {
    prevTrackOverflowX = trackColEl.style.overflowX;
    prevTrackWidth = trackColEl.style.width;
    prevWrapperWidth = wrapperEl.style.width;

    trackColEl.style.overflowX = "visible";
    trackColEl.style.width = `${trackColEl.scrollWidth}px`;

    captureWidth = wrapperEl.scrollWidth;
    captureHeight = wrapperEl.scrollHeight;
    wrapperEl.style.width = `${captureWidth}px`;
  }

  try {
    const sizeOverride = captureWidth !== undefined
      ? ({ width: captureWidth, ...(captureHeight !== undefined ? { height: captureHeight } : {}) })
      : undefined;
    const dataUrl = await captureElement(wrapperEl, sizeOverride);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeFilename(title)}_${mode === "full" ? "full" : "current"}.png`;
    a.click();
  } finally {
    if (mode === "full" && trackColEl) {
      trackColEl.style.overflowX = prevTrackOverflowX;
      trackColEl.style.width = prevTrackWidth;
      wrapperEl.style.width = prevWrapperWidth;
    }
  }
};

const exportChartPDF = async (wrapperEl: HTMLElement, title: string): Promise<void> => {
  const { jsPDF } = await import("jspdf");

  const dataUrl = await captureElement(wrapperEl);

  // Resolve natural image dimensions (captured at pixelRatio 2, so halve for CSS px)
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => { img.onload = () => resolve(); });
  const imgCssW = img.width / 2;
  const imgCssH = img.height / 2;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 297mm
  const pageH = doc.internal.pageSize.getHeight();  // 210mm
  const margin = 14;
  const titleH = 12;
  const availW = pageW - margin * 2;
  const availH = pageH - margin - titleH - margin;

  // Scale image to fit available area while preserving aspect ratio
  const scale = Math.min(availW / imgCssW, availH / imgCssH);
  const drawW = imgCssW * scale;
  const drawH = imgCssH * scale;

  doc.setFontSize(14);
  doc.setTextColor(36, 47, 47);
  doc.text(title, margin, margin + 6);

  doc.addImage(dataUrl, "PNG", margin, margin + titleH, drawW, drawH);
  doc.save(`${safeFilename(title)}_chart.pdf`);
};

const exportPDF = async (items: TimelineItem[], title: string): Promise<void> => {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const rows = buildRows(items);
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

  autoTable(doc, {
    startY: 30,
    head: [["Type", "#", "Title", "Author", "Status", "Opened", "Closed/Merged", "Days", "Linked to"]],
    body: rows.map((r) => [r.type, r.num, r.title, r.author, r.status, r.opened, r.closed, r.duration, r.linked]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [9, 105, 218], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 14 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 22 },
      4: { cellWidth: 17 },
      5: { cellWidth: 24 },
      6: { cellWidth: 24 },
      7: { cellWidth: 12 },
      8: { cellWidth: 26 },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const url = rows[data.row.index]?.url;
        if (url) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
        }
      }
    },
  });

  doc.save(`${safeFilename(title)}.pdf`);
};

const exportXLSX = async (items: TimelineItem[], title: string): Promise<void> => {
  const { default: writeXlsxFile } = await import("write-excel-file");

  const rows = buildRows(items);

  const HEADER = {
    fontWeight: "bold" as const,
    backgroundColor: "#0969DA",
    color: "#FFFFFF",
  };

  const headerRow = COLS.map((value) => ({ value, ...HEADER }));

  const dataRows = rows.map((r) => [
    { value: r.type },
    { value: r.num },
    { value: r.title },
    { value: r.author },
    { value: r.status },
    { value: r.opened },
    { value: r.closed },
    { value: r.duration },
    { value: r.linked },
    { value: r.url },
  ]);

  await writeXlsxFile([headerRow, ...dataRows], {
    columns: [
      { width: 8 },
      { width: 10 },
      { width: 52 },
      { width: 18 },
      { width: 10 },
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
  num: string;
  title: string;
  author: string;
  status: string;
  created: string;
  firstReview: string;
  waitDays: string;
  totalDays: string;
  url: string;
};

const RW_COLS = ["#", "Title", "Author", "Status", "Created", "First Review", "Wait (days)", "Total (days)", "URL"] as const;

const buildReviewWaitRows = (items: TimelineItem[]): ReviewWaitRow[] =>
  items
    .filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr")
    .map((pr) => {
      const createdMs = new Date(pr.createdAt).getTime();
      const endMs = pr.mergedAt
        ? new Date(pr.mergedAt).getTime()
        : pr.closedAt ? new Date(pr.closedAt).getTime() : null;
      const reviewMs = pr.firstReviewAt ? new Date(pr.firstReviewAt).getTime() : null;
      const waitDays = reviewMs !== null ? Math.max(0, Math.round((reviewMs - createdMs) / MS)) : null;
      const totalDays = endMs !== null ? Math.max(0, Math.round((endMs - createdMs) / MS)) : null;
      const status = pr.mergedAt ? "Merged" : pr.closedAt ? "Closed" : "Open";
      return {
        num: `#${pr.number}`,
        title: pr.title,
        author: pr.author,
        status,
        created: fmtDate(pr.createdAt, true),
        firstReview: pr.firstReviewAt ? fmtDate(pr.firstReviewAt, true) : "—",
        waitDays: waitDays !== null ? String(waitDays) : "—",
        totalDays: totalDays !== null ? String(totalDays) : "open",
        url: pr.url,
      };
    })
    .sort((a, b) => {
      const wa = a.waitDays === "—" ? -1 : Number(a.waitDays);
      const wb = b.waitDays === "—" ? -1 : Number(b.waitDays);
      return wb - wa; // descending wait, matching default sort in the component
    });

const exportReviewWaitCSV = (items: TimelineItem[], title: string): void => {
  const rows = buildReviewWaitRows(items);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    RW_COLS.map(esc).join(","),
    ...rows.map((r) =>
      [r.num, r.title, r.author, r.status, r.created, r.firstReview, r.waitDays, r.totalDays, r.url].map(esc).join(","),
    ),
  ];
  triggerBlobDownload(lines.join("\r\n"), `${safeFilename(title)}_review_wait.csv`, "text/csv;charset=utf-8;");
};

const exportReviewWaitMarkdown = (items: TimelineItem[], title: string): void => {
  const rows = buildReviewWaitRows(items);
  const pipe = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    `# ${title} — Review Wait`,
    "",
    "| # | Title | Author | Status | Created | First Review | Wait (days) | Total (days) |",
    "|---|-------|--------|--------|---------|--------------|-------------|--------------|",
    ...rows.map(
      (r) => `| [${r.num}](${r.url}) | ${pipe(r.title)} | ${r.author} | ${r.status} | ${r.created} | ${r.firstReview} | ${r.waitDays} | ${r.totalDays} |`,
    ),
  ];
  triggerBlobDownload(lines.join("\n"), `${safeFilename(title)}_review_wait.md`, "text/markdown;charset=utf-8;");
};

const exportReviewWaitXLSX = async (items: TimelineItem[], title: string): Promise<void> => {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const rows = buildReviewWaitRows(items);
  const HEADER = { fontWeight: "bold" as const, backgroundColor: "#0969DA", color: "#FFFFFF" };
  const headerRow = RW_COLS.map((value) => ({ value, ...HEADER }));
  const dataRows = rows.map((r) => [
    { value: r.num },
    { value: r.title },
    { value: r.author },
    { value: r.status },
    { value: r.created },
    { value: r.firstReview },
    { value: r.waitDays },
    { value: r.totalDays },
    { value: r.url },
  ]);
  await writeXlsxFile([headerRow, ...dataRows], {
    columns: [{ width: 8 }, { width: 52 }, { width: 18 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 44 }],
    fileName: `${safeFilename(title)}_review_wait.xlsx`,
  });
};

const exportReviewWaitPDF = async (items: TimelineItem[], title: string): Promise<void> => {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const rows = buildReviewWaitRows(items);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(36, 47, 47);
  doc.text(`${title} — Review Wait`, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(87, 96, 106);
  doc.text(`Generated ${fmtDate(new Date().toISOString(), true)}  ·  ${rows.length} PR${rows.length !== 1 ? "s" : ""}`, 14, 25);
  autoTable(doc, {
    startY: 30,
    head: [["#", "Title", "Author", "Status", "Created", "First Review", "Wait (d)", "Total (d)"]],
    body: rows.map((r) => [r.num, r.title, r.author, r.status, r.created, r.firstReview, r.waitDays, r.totalDays]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [9, 105, 218], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 22 },
      3: { cellWidth: 16 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 16 },
      7: { cellWidth: 16 },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const url = rows[data.row.index]?.url;
        if (url) { doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url }); }
      }
    },
  });
  doc.save(`${safeFilename(title)}_review_wait.pdf`);
};

export { buildRows, exportCSV, exportChartPDF, exportMarkdown, exportPDF, exportPNG, exportReviewWaitCSV, exportReviewWaitMarkdown, exportReviewWaitPDF, exportReviewWaitXLSX, exportXLSX, safeFilename };

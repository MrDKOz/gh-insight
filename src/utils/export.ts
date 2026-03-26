import type { TimelineItem } from "../types";
import { itemEndDate } from "./utils";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function safeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

function buildRows(items: TimelineItem[]): Row[] {
  return items
    .filter((item) => (item.type === "issue" ? !!item.closedAt : !!(item.mergedAt || item.closedAt)))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => {
      const endDate = itemEndDate(item);
      const status = item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
      const days =
        endDate != null
          ? Math.round((new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / 86_400_000)
          : null;
      const linked =
        item.type === "pr"
          ? `Issue #${item.linkedIssue}`
          : item.linkedPRs.length > 0
            ? item.linkedPRs.map((n) => `PR #${n}`).join(", ")
            : "—";
      return {
        type: item.type === "issue" ? "Issue" : "PR",
        num: `#${item.number}`,
        title: item.title,
        author: item.author,
        status,
        opened: fmtDate(item.createdAt),
        closed: fmtDate(endDate),
        duration: days != null ? String(days) : "—",
        linked,
        url: item.url,
      };
    });
}

const COLS = ["Type", "Number", "Title", "Author", "Status", "Opened", "Closed/Merged", "Duration (days)", "Linked to", "URL"] as const;

function exportCSV(items: TimelineItem[], title: string): void {
  const rows = buildRows(items);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    COLS.map(esc).join(","),
    ...rows.map((r) =>
      [r.type, r.num, r.title, r.author, r.status, r.opened, r.closed, r.duration, r.linked, r.url].map(esc).join(","),
    ),
  ];
  triggerBlobDownload(lines.join("\r\n"), `${safeFilename(title)}.csv`, "text/csv;charset=utf-8;");
}

function exportMarkdown(items: TimelineItem[], title: string): void {
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
}

async function exportPNG(
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  title: string,
  mode: "current" | "full",
): Promise<void> {
  const { toPng } = await import("html-to-image");

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
    const dataUrl = await toPng(wrapperEl, {
      cacheBust: true,
      pixelRatio: 2,
      ...(captureWidth !== undefined ? { width: captureWidth } : {}),
      ...(captureHeight !== undefined ? { height: captureHeight } : {}),
      filter: (node) => !(node instanceof Element && node.hasAttribute("data-export-exclude")),
    });
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
}

async function exportPDF(items: TimelineItem[], title: string): Promise<void> {
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
    `Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}  ·  ${rows.length} item${rows.length !== 1 ? "s" : ""}`,
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
}

async function exportXLSX(items: TimelineItem[], title: string): Promise<void> {
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
}

export { exportCSV, exportMarkdown, exportPNG, exportPDF, exportXLSX };

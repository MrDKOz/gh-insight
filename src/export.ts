/**
 * Export utilities for the milestone timeline.
 *
 * Libraries used and their licences (all business-safe):
 *   html-to-image    MIT  https://github.com/bubkoo/html-to-image
 *   jspdf            MIT  https://github.com/parallax/jsPDF
 *   jspdf-autotable  MIT  https://github.com/simonbengtsson/jsPDF-AutoTable
 *   write-excel-file MIT  https://github.com/catamphetamine/write-excel-file
 */

import type { TimelineItem } from './types';

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function safeFilename(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Row {
  type: string;
  num: string;
  title: string;
  status: string;
  opened: string;
  closed: string;
  duration: string;
  linked: string;
  url: string;
}

function buildRows(items: TimelineItem[]): Row[] {
  return items
    .filter(item =>
      item.type === 'issue' ? !!item.closedAt : !!(item.mergedAt || item.closedAt),
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(item => {
      const endDate =
        item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
      const status =
        item.type === 'pr' ? (item.mergedAt ? 'Merged' : 'Closed') : 'Closed';
      const days =
        endDate != null
          ? Math.round(
              (new Date(endDate).getTime() - new Date(item.createdAt).getTime()) /
                86_400_000,
            )
          : null;
      const linked =
        item.type === 'pr'
          ? `Issue #${item.linkedIssue}`
          : item.linkedPRs.length > 0
            ? item.linkedPRs.map(n => `PR #${n}`).join(', ')
            : '—';
      return {
        type: item.type === 'issue' ? 'Issue' : 'PR',
        num: `#${item.number}`,
        title: item.title,
        status,
        opened: fmtDate(item.createdAt),
        closed: fmtDate(endDate),
        duration: days != null ? String(days) : '—',
        linked,
        url: item.url,
      };
    });
}

const COLS = ['Type', 'Number', 'Title', 'Status', 'Opened', 'Closed/Merged', 'Duration (days)', 'Linked to', 'URL'] as const;

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCSV(items: TimelineItem[], title: string): void {
  const rows = buildRows(items);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    COLS.map(esc).join(','),
    ...rows.map(r =>
      [r.type, r.num, r.title, r.status, r.opened, r.closed, r.duration, r.linked, r.url]
        .map(esc)
        .join(','),
    ),
  ];
  triggerBlobDownload(
    lines.join('\r\n'),
    `${safeFilename(title)}.csv`,
    'text/csv;charset=utf-8;',
  );
}

// ── Markdown ──────────────────────────────────────────────────────────────────

export function exportMarkdown(items: TimelineItem[], title: string): void {
  const rows = buildRows(items);
  const pipe = (s: string) => s.replace(/\|/g, '\\|');
  const lines = [
    `# ${title}`,
    '',
    '| Type | # | Title | Status | Opened | Closed/Merged | Duration | Linked to |',
    '|------|---|-------|--------|--------|---------------|----------|-----------|',
    ...rows.map(
      r =>
        `| ${r.type} | [${r.num}](${r.url}) | ${pipe(r.title)} | ${r.status} | ${r.opened} | ${r.closed} | ${r.duration === '—' ? '—' : `${r.duration} days`} | ${r.linked} |`,
    ),
  ];
  triggerBlobDownload(
    lines.join('\n'),
    `${safeFilename(title)}.md`,
    'text/markdown;charset=utf-8;',
  );
}

// ── PNG ───────────────────────────────────────────────────────────────────────

export async function exportPNG(
  wrapperEl: HTMLElement,
  trackColEl: HTMLElement | null,
  title: string,
  mode: 'current' | 'full',
): Promise<void> {
  const { toPng } = await import('html-to-image');

  // For the full Gantt export, temporarily expand the scrollable track column
  // so all bars are visible, then also widen the wrapper so html-to-image
  // captures the full content rather than clipping at its CSS box width.
  // For other views (trackColEl is null) or current-view mode, capture as-is.
  let prevTrackOverflowX = '';
  let prevTrackWidth = '';
  let prevWrapperWidth = '';
  let captureWidth: number | undefined;
  let captureHeight: number | undefined;

  if (mode === 'full' && trackColEl) {
    prevTrackOverflowX = trackColEl.style.overflowX;
    prevTrackWidth = trackColEl.style.width;
    prevWrapperWidth = wrapperEl.style.width;

    // Expand track column to its full scroll width
    trackColEl.style.overflowX = 'visible';
    trackColEl.style.width = `${trackColEl.scrollWidth}px`;

    // Expand the wrapper so its inline width overrides any CSS max-width,
    // letting html-to-image see and capture all the content
    captureWidth  = wrapperEl.scrollWidth;
    captureHeight = wrapperEl.scrollHeight;
    wrapperEl.style.width = `${captureWidth}px`;
  }

  try {
    const dataUrl = await toPng(wrapperEl, {
      cacheBust: true,
      pixelRatio: 2,
      ...(captureWidth  !== undefined ? { width:  captureWidth  } : {}),
      ...(captureHeight !== undefined ? { height: captureHeight } : {}),
      filter: node =>
        !(node instanceof Element && node.hasAttribute('data-export-exclude')),
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${safeFilename(title)}_${mode === 'full' ? 'full' : 'current'}.png`;
    a.click();
  } finally {
    if (mode === 'full' && trackColEl) {
      trackColEl.style.overflowX = prevTrackOverflowX;
      trackColEl.style.width = prevTrackWidth;
      wrapperEl.style.width = prevWrapperWidth;
    }
  }
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function exportPDF(items: TimelineItem[], title: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const rows = buildRows(items);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setTextColor(36, 41, 47);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(87, 96, 106);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}  ·  ${rows.length} item${rows.length !== 1 ? 's' : ''}`,
    14,
    25,
  );

  // Table (landscape A4 = 297mm wide, 14mm margins each side = 269mm usable)
  autoTable(doc, {
    startY: 30,
    head: [['Type', '#', 'Title', 'Status', 'Opened', 'Closed/Merged', 'Days', 'Linked to']],
    body: rows.map(r => [
      r.type,
      r.num,
      r.title,
      r.status,
      r.opened,
      r.closed,
      r.duration,
      r.linked,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [9, 105, 218], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 13 },     // Type
      1: { cellWidth: 14 },     // # (clickable)
      2: { cellWidth: 'auto' }, // Title
      3: { cellWidth: 17 },     // Status
      4: { cellWidth: 24 },     // Opened
      5: { cellWidth: 24 },     // Closed/Merged
      6: { cellWidth: 12 },     // Days
      7: { cellWidth: 26 },     // Linked to
    },
    // Overlay a clickable link on each # cell
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const url = rows[data.row.index]?.url;
        if (url) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
        }
      }
    },
  });

  doc.save(`${safeFilename(title)}.pdf`);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────

export async function exportXLSX(items: TimelineItem[], title: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file');

  const rows = buildRows(items);

  const HEADER = {
    fontWeight: 'bold' as const,
    backgroundColor: '#0969DA',
    color: '#FFFFFF',
  };

  const headerRow = COLS.map(value => ({ value, ...HEADER }));

  const dataRows = rows.map(r => [
    { value: r.type },
    { value: r.num },
    { value: r.title },
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

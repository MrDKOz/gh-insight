// Stub for jsPDF's html2canvas dynamic import.
// jsPDF bundles a .html() plugin that lazily imports html2canvas; we never
// call jsPDF.html(), so this stub prevents the real html2canvas (≈200 KB)
// from being included in the production bundle.
const html2canvas = (_element: Element, _options?: unknown): Promise<HTMLCanvasElement> =>
  Promise.reject(new Error("html2canvas is not available in this build"));

export default html2canvas;

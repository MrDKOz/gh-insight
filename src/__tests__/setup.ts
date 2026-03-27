import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia — MUI's responsive utilities call it at render time
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement ResizeObserver — MUI components may observe element sizes
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", { writable: true, value: MockResizeObserver });

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy  = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (warnSpy.mock.calls.length > 0) {
    const calls = warnSpy.mock.calls;
    warnSpy.mockRestore();
    throw new Error(`Unexpected console.warn:\n${calls.map((c: unknown[]) => c.join(" ")).join("\n")}`);
  }
  if (errorSpy.mock.calls.length > 0) {
    const calls = errorSpy.mock.calls;
    errorSpy.mockRestore();
    throw new Error(`Unexpected console.error:\n${calls.map((c: unknown[]) => c.join(" ")).join("\n")}`);
  }
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

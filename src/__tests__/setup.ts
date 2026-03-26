import { beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (warnSpy.mock.calls.length > 0) {
    const calls = warnSpy.mock.calls;
    warnSpy.mockRestore();
    throw new Error(`Unexpected console.warn:\n${calls.map((c: unknown[]) => c.join(' ')).join('\n')}`);
  }
  if (errorSpy.mock.calls.length > 0) {
    const calls = errorSpy.mock.calls;
    errorSpy.mockRestore();
    throw new Error(`Unexpected console.error:\n${calls.map((c: unknown[]) => c.join(' ')).join('\n')}`);
  }
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

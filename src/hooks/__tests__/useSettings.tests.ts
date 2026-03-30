import { act, renderHook } from "@testing-library/react";
import { useSettings } from "../useSettings";

const LS_KEY = "gmt_settings";

beforeEach(() => localStorage.clear());

afterEach(() => localStorage.clear());

describe("useSettings — initial state", () => {
  it("returns DEFAULT_SETTINGS when localStorage is empty", () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      highlightWeekends: false,
      colorblindMode: false,
      highlightBankHolidays: false,
      bankHolidayRegions: ["england-and-wales"],
    });
  });

  it("parses valid stored JSON", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      highlightWeekends: true,
      colorblindMode: true,
      highlightBankHolidays: true,
      bankHolidayRegions: ["scotland", "US"],
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      highlightWeekends: true,
      colorblindMode: true,
      highlightBankHolidays: true,
      bankHolidayRegions: ["scotland", "US"],
    });
  });

  it("falls back to DEFAULT_SETTINGS for completely corrupted JSON", () => {
    localStorage.setItem(LS_KEY, "not-json{{{{");

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      highlightWeekends: false,
      colorblindMode: false,
      highlightBankHolidays: false,
      bankHolidayRegions: ["england-and-wales"],
    });
  });

  it("falls back to DEFAULT_SETTINGS when stored value is not an object", () => {
    localStorage.setItem(LS_KEY, JSON.stringify(42));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual({
      highlightWeekends: false,
      colorblindMode: false,
      highlightBankHolidays: false,
      bankHolidayRegions: ["england-and-wales"],
    });
  });

  it("uses defaults for boolean fields that are missing", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegions: ["US"],
      // booleans omitted
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.highlightWeekends).toBe(false);
    expect(result.current.settings.colorblindMode).toBe(false);
    expect(result.current.settings.highlightBankHolidays).toBe(false);
    // valid region should still be used
    expect(result.current.settings.bankHolidayRegions).toEqual(["US"]);
  });

  it("uses defaults for boolean fields with wrong type", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      highlightWeekends: "yes",    // string, not boolean
      colorblindMode: 1,           // number, not boolean
      highlightBankHolidays: null, // null, not boolean
      bankHolidayRegions: ["US"],
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.highlightWeekends).toBe(false);
    expect(result.current.settings.colorblindMode).toBe(false);
    expect(result.current.settings.highlightBankHolidays).toBe(false);
  });
});

describe("useSettings — bankHolidayRegions", () => {
  it("falls back to default when the array contains an invalid region value", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegions: ["england-and-wales", "atlantis", "US"],
    }));

    const { result } = renderHook(() => useSettings());

    // The codec rejects the entire array if any element is invalid, so we get the default.
    expect(result.current.settings.bankHolidayRegions).toEqual(["england-and-wales"]);
  });

  it("falls back to default when array contains only invalid regions", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegions: ["atlantis", "narnia"],
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.bankHolidayRegions).toEqual(["england-and-wales"]);
  });

  it("falls back to default when bankHolidayRegions is an empty array", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegions: [],
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.bankHolidayRegions).toEqual(["england-and-wales"]);
  });

  it("migrates old bankHolidayRegion (string) to bankHolidayRegions (array)", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegion: "scotland",
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.bankHolidayRegions).toEqual(["scotland"]);
  });

  it("ignores old bankHolidayRegion when bankHolidayRegions array is present", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegion: "scotland",
      bankHolidayRegions: ["US"],
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.bankHolidayRegions).toEqual(["US"]);
  });

  it("falls back to default when old bankHolidayRegion is invalid", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bankHolidayRegion: "atlantis",
    }));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.bankHolidayRegions).toEqual(["england-and-wales"]);
  });
});

describe("useSettings — updateSetting", () => {
  it("updates the returned settings value", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("highlightWeekends", true);
    });

    expect(result.current.settings.highlightWeekends).toBe(true);
  });

  it("does not mutate other settings when one is updated", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      highlightWeekends: true,
      colorblindMode: true,
      highlightBankHolidays: true,
      bankHolidayRegions: ["US"],
    }));

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("colorblindMode", false);
    });

    expect(result.current.settings.colorblindMode).toBe(false);
    expect(result.current.settings.highlightWeekends).toBe(true);
    expect(result.current.settings.highlightBankHolidays).toBe(true);
    expect(result.current.settings.bankHolidayRegions).toEqual(["US"]);
  });

  it("persists the updated value to localStorage", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("colorblindMode", true);
    });

    const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, unknown>;

    expect(stored["colorblindMode"]).toBe(true);
  });

  it("persists the full settings object (not just the changed key)", () => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      highlightWeekends: true,
      colorblindMode: false,
      highlightBankHolidays: false,
      bankHolidayRegions: ["scotland"],
    }));
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("colorblindMode", true);
    });

    const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, unknown>;

    expect(stored["highlightWeekends"]).toBe(true);
    expect(stored["bankHolidayRegions"]).toEqual(["scotland"]);
  });

  it("updates bankHolidayRegions to an array value", () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("bankHolidayRegions", ["scotland", "northern-ireland"]);
    });

    expect(result.current.settings.bankHolidayRegions).toEqual(["scotland", "northern-ireland"]);
  });

  it("state still updates when localStorage.setItem throws (quota exceeded)", () => {
    const original = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSetting("highlightWeekends", true);
    });

    // In-memory state should still be updated
    expect(result.current.settings.highlightWeekends).toBe(true);

    spy.mockRestore();
    void original; // suppress unused-variable warning
  });

  it("updateSetting is referentially stable (memoised)", () => {
    const { result, rerender } = renderHook(() => useSettings());
    const first = result.current.updateSetting;

    act(() => {
      result.current.updateSetting("colorblindMode", true);
    });
    rerender();

    expect(result.current.updateSetting).toBe(first);
  });
});

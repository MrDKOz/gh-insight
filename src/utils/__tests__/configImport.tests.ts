import { parseImportConfig } from "../configImport";

describe("parseImportConfig", () => {
  it("accepts a minimal valid config with only version", () => {
    const result = parseImportConfig({ version: 1 });

    expect(typeof result).toBe("object");
    expect((result as { version: number }).version).toBe(1);
  });

  it("accepts a full valid config", () => {
    const raw = {
      version: 1,
      dark: true,
      token: "ghp_abc123",
      settings: {
        highlightWeekends: true,
        colorblindMode: false,
        highlightBankHolidays: true,
        bankHolidayRegions: ["england-and-wales", "scotland"],
      },
    };
    const result = parseImportConfig(raw);

    expect(typeof result).toBe("object");
    expect((result as typeof raw).dark).toBe(true);
    expect((result as typeof raw).settings?.bankHolidayRegions).toEqual(["england-and-wales", "scotland"]);
  });

  it("rejects a config with the wrong version number", () => {
    const result = parseImportConfig({ version: 2 });

    expect(typeof result).toBe("string"); // error message
  });

  it("rejects a config missing the version field", () => {
    const result = parseImportConfig({ dark: true });

    expect(typeof result).toBe("string");
  });

  it("rejects a non-object input", () => {
    expect(typeof parseImportConfig(null)).toBe("string");
    expect(typeof parseImportConfig("not an object")).toBe("string");
    expect(typeof parseImportConfig(42)).toBe("string");
  });

  it("rejects an invalid bankHolidayRegion value", () => {
    const result = parseImportConfig({
      version: 1,
      settings: { bankHolidayRegions: ["invalid-region"] },
    });

    expect(typeof result).toBe("string");
  });

  it("accepts a valid US region", () => {
    const result = parseImportConfig({
      version: 1,
      settings: { bankHolidayRegions: ["US"] },
    });

    expect(typeof result).toBe("object");
  });

  it("accepts optional fields being absent (partial type)", () => {
    const result = parseImportConfig({ version: 1, settings: { colorblindMode: true } });

    expect(typeof result).toBe("object");
    expect((result as { settings?: { colorblindMode?: boolean } }).settings?.colorblindMode).toBe(true);
  });
});

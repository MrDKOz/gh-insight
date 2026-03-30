import type { Repo } from "../types/GitHubTypes";
import type { Settings } from "../types/SettingsTypes";
import type { ChangeEvent, RefObject } from "react";
import { useCallback, useRef, useState } from "react";
import { parseImportConfig } from "../utils/configImport";

type UseConfigImportExportOptions = {
  activeRepo:        Repo | null;
  dark:              boolean;
  settings:          Settings;
  applyDark:         (dark: boolean) => void;
  setToken:          (token: string) => void;
  saveToken:         (token: string) => void;
  updateSetting:     <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onImportSuccess:   () => void;
};

type UseConfigImportExportReturn = {
  configError:        string | null;
  clearConfigError:   () => void;
  fileInputRef:       RefObject<HTMLInputElement | null>;
  handleExportConfig: () => void;
  handleImportConfig: (e: ChangeEvent<HTMLInputElement>) => void;
};

const useConfigImportExport = ({
  activeRepo,
  dark,
  settings,
  applyDark,
  setToken,
  saveToken,
  updateSetting,
  onImportSuccess,
}: UseConfigImportExportOptions): UseConfigImportExportReturn => {
  const [configError, setConfigError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportConfig = useCallback(() => {
    const config = { version: 1, owner: activeRepo?.owner ?? "", repo: activeRepo?.name ?? "", dark, settings };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url; a.download = "github-work-visualiser-config.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [activeRepo, dark, settings]);

  const handleImportConfig = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result !== "string") { setConfigError("Config import failed: file could not be read as text"); return; }
      let raw: unknown;
      try { raw = JSON.parse(ev.target.result); } catch { setConfigError("Config import failed: invalid file"); return; }
      const config = parseImportConfig(raw);
      if (typeof config === "string") { setConfigError(`Config import failed: ${config}`); return; }
      if (config.dark !== undefined) { applyDark(config.dark); }
      if (config.token)              { setToken(config.token); saveToken(config.token); }
      if (config.settings) {
        const { highlightWeekends, colorblindMode, highlightBankHolidays, bankHolidayRegions } = config.settings;
        if (highlightWeekends     !== undefined) { updateSetting("highlightWeekends",     highlightWeekends); }
        if (colorblindMode        !== undefined) { updateSetting("colorblindMode",        colorblindMode); }
        if (highlightBankHolidays !== undefined) { updateSetting("highlightBankHolidays", highlightBankHolidays); }
        if (bankHolidayRegions    !== undefined) { updateSetting("bankHolidayRegions",    bankHolidayRegions); }
      }
      onImportSuccess();
    };
    reader.readAsText(file);
  }, [applyDark, setToken, saveToken, updateSetting, onImportSuccess]);

  return {
    configError,
    clearConfigError: useCallback(() => setConfigError(null), []),
    fileInputRef,
    handleExportConfig,
    handleImportConfig,
  };
};

export { useConfigImportExport };

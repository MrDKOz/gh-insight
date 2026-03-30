import { useCallback, useState } from "react";

const LS_DARK = "gmt_dark";

const initDark = (): boolean => {
  const isDark = localStorage.getItem(LS_DARK) !== "false";
  document.body.classList.toggle("dark", isDark);
  return isDark;
};

// Evaluated once at module load — sets the initial body class before first render
const INITIAL_DARK = initDark();

const useDarkMode = () => {
  const [dark, setDarkState] = useState(INITIAL_DARK);

  const applyDark = useCallback((value: boolean) => {
    setDarkState(value);
    localStorage.setItem(LS_DARK, String(value));
    document.body.classList.toggle("dark", value);
  }, []);

  const toggleDark = useCallback(() => {
    setDarkState((prev) => {
      const next = !prev;
      localStorage.setItem(LS_DARK, String(next));
      document.body.classList.toggle("dark", next);
      return next;
    });
  }, []);

  return { dark, toggleDark, applyDark };
};

export { useDarkMode };

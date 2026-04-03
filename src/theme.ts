import { createTheme } from "@mui/material/styles";

const shared = {
  typography: {
    fontFamily: ["Roboto", "sans-serif"].join(", "),
    button: { fontSize: "0.875rem", fontWeight: 500, textTransform: "none" as const },
  },
  components: {
    MuiButton:     { defaultProps: { variant: "contained" as const } },
    MuiChip:       { defaultProps: { variant: "filled"    as const } },
    MuiDialogContent: { defaultProps: { dividers: false } },
  },
};

const muiLightTheme = createTheme({
  ...shared,
  palette: { mode: "light" },
});

const muiDarkTheme = createTheme({
  ...shared,
  palette: { mode: "dark" },
});

export { muiDarkTheme, muiLightTheme };

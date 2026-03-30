import type { ThemeOptions } from "@mui/material/styles";
import { createTheme } from "@mui/material/styles";
import { darkTheme, lightTheme } from "@redgate/honeycomb-mui-theme";

const muiLightTheme = createTheme(lightTheme as unknown as ThemeOptions);
const muiDarkTheme  = createTheme(darkTheme  as unknown as ThemeOptions);

export { muiDarkTheme, muiLightTheme };

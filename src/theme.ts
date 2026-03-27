import { createTheme } from "@mui/material/styles";
import { darkTheme, lightTheme } from "@redgate/honeycomb-mui-theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const muiLightTheme = createTheme(lightTheme as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const muiDarkTheme = createTheme(darkTheme as any);

export { muiDarkTheme, muiLightTheme };

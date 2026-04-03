import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render } from "@testing-library/react";
import { HelpPopover } from "../HelpPopover";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("HelpPopover — interaction", () => {
  it("dialog is not visible on initial render", () => {
    const { queryByText } = wrap(<HelpPopover />);

    expect(queryByText("How it works")).not.toBeInTheDocument();
  });

  it("clicking the about button opens the dialog", () => {
    const { getByRole, getByText } = wrap(<HelpPopover />);

    fireEvent.click(getByRole("button", { name: "About this app" }));

    expect(getByText("How it works")).toBeInTheDocument();
  });
});

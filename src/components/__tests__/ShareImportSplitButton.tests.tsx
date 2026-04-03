import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ShareImportSplitButton } from "../ShareImportSplitButton";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("ShareImportSplitButton — interaction", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("shows 'Copied!' after clicking the share button", async () => {
    const { getByRole, findByText } = wrap(
      <ShareImportSplitButton onImportCode={async () => {}} />,
    );

    fireEvent.click(getByRole("button", { name: "Copy share code to clipboard" }));

    await findByText("Copied!");
  });

  it("calls clipboard.writeText with the encoded share code", async () => {
    const { getByRole } = wrap(
      <ShareImportSplitButton onImportCode={async () => {}} />,
    );

    fireEvent.click(getByRole("button", { name: "Copy share code to clipboard" }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
  });
});

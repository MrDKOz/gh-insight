import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { act, fireEvent, render } from "@testing-library/react";
import { ItemPicker } from "../ItemPicker";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

type Item = { number: number; title: string };

const items: Item[] = [
  { number: 1, title: "Milestone Alpha" },
  { number: 2, title: "Milestone Beta" },
  { number: 3, title: "Milestone Gamma" },
];

const defaultProps = {
  items,
  selected: [] as Item[],
  loadingNums: [] as number[],
  hasMore: false,
  loadingMore: false,
  colorFor: () => "#0066cc",
  onAdd: () => {},
  onRemove: () => {},
  onLoadMore: () => {},
  chipLabel: (item: Item) => item.title,
  caption: (item: Item) => `#${item.number}`,
  emptyPlaceholder: "Pick a milestone…",
  addPlaceholder: "Add another…",
  loadMoreLabel: "Load more",
  loadingMoreLabel: "Loading…",
};

describe("ItemPicker — rendering", () => {
  it("renders the autocomplete input", () => {
    const { getByRole } = wrap(<ItemPicker {...defaultProps} />);
    expect(getByRole("combobox")).toBeInTheDocument();
  });

  it("shows selected items as chips", () => {
    const { getByText } = wrap(
      <ItemPicker {...defaultProps} selected={[items[0]]} />,
    );
    expect(getByText("Milestone Alpha")).toBeInTheDocument();
  });

  it("calls onRemove when a chip delete icon is clicked", () => {
    const onRemove = vi.fn();
    const { container } = wrap(
      <ItemPicker {...defaultProps} selected={[items[0]]} onRemove={onRemove} />,
    );
    const deleteIcon = container.querySelector(".MuiChip-deleteIcon");
    expect(deleteIcon).not.toBeNull();
    fireEvent.click(deleteIcon!);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("hides the autocomplete when all items are selected", () => {
    const { queryByRole } = wrap(
      <ItemPicker {...defaultProps} selected={items} />,
    );
    expect(queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("ItemPicker — dropdown", () => {
  it("opens and lists all options on focus", () => {
    const { getByRole, getAllByRole } = wrap(<ItemPicker {...defaultProps} />);
    fireEvent.focus(getByRole("combobox"));
    expect(getByRole("listbox")).toBeInTheDocument();
    expect(getAllByRole("option")).toHaveLength(3);
  });

  it("excludes already-selected items from the dropdown", () => {
    const { getByRole, getAllByRole } = wrap(
      <ItemPicker {...defaultProps} selected={[items[0]]} />,
    );
    fireEvent.focus(getByRole("combobox"));
    const options = getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.every((o) => !o.textContent?.includes("Milestone Alpha"))).toBe(true);
  });

  it("calls onAdd when an option is clicked", () => {
    const onAdd = vi.fn();
    const { getByRole, getByText } = wrap(
      <ItemPicker {...defaultProps} onAdd={onAdd} />,
    );
    fireEvent.focus(getByRole("combobox"));
    fireEvent.click(getByText("Milestone Beta"));
    expect(onAdd).toHaveBeenCalledWith(items[1]);
  });

  it("filters options by input text", () => {
    const { getByRole, getAllByRole } = wrap(<ItemPicker {...defaultProps} />);
    const input = getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Beta" } });
    const options = getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Milestone Beta");
  });

  it("shows load-more button when hasMore is true", () => {
    const { getByRole, getByText } = wrap(
      <ItemPicker {...defaultProps} hasMore />,
    );
    fireEvent.focus(getByRole("combobox"));
    expect(getByText("Load more")).toBeInTheDocument();
  });

  it("calls onLoadMore when the load-more button is clicked", async () => {
    const onLoadMore = vi.fn();
    const { getByRole, getByText } = wrap(
      <ItemPicker {...defaultProps} hasMore onLoadMore={onLoadMore} />,
    );
    fireEvent.focus(getByRole("combobox"));
    await act(async () => { fireEvent.mouseDown(getByText("Load more")); });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("load-more button is disabled and shows loading text when loadingMore is true", () => {
    const onLoadMore = vi.fn();
    const { getByRole, getByText } = wrap(
      <ItemPicker {...defaultProps} loadingMore onLoadMore={onLoadMore} />,
    );
    fireEvent.focus(getByRole("combobox"));
    expect(getByText("Loading…")).toBeInTheDocument();
    fireEvent.mouseDown(getByText("Loading…"));
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});

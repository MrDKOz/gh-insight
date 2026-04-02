import type { PaperProps } from "@mui/material/Paper";
import type { Key } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useRef, useState } from "react";
import { DOT_SX } from "../utils/sxTokens";

type BaseItem = { number: number; title: string };

type Props<T extends BaseItem> = {
  items: T[];
  selected: T[];
  loadingNums: number[];
  hasMore: boolean;
  loadingMore: boolean;
  colorFor: (num: number) => string;
  onAdd: (item: T) => void;
  onRemove: (num: number) => void;
  onLoadMore: () => void;
  chipLabel: (item: T) => string;
  caption: (item: T) => string;
  emptyPlaceholder: string;
  addPlaceholder: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
};

const ItemPicker = <T extends BaseItem,>({
  items, selected, loadingNums, hasMore, loadingMore, colorFor,
  onAdd, onRemove, onLoadMore,
  chipLabel, caption, emptyPlaceholder, addPlaceholder, loadMoreLabel, loadingMoreLabel,
}: Props<T>) => {
  const [inputValue, setInputValue] = useState("");
  const unselected = items.filter((item) => !selected.find((s) => s.number === item.number));

  // Stable ref read by PaperWithFooter so the component is only created once
  const footerRef = useRef({ hasMore, loadingMore, onLoadMore, loadMoreLabel, loadingMoreLabel });
  footerRef.current = { hasMore, loadingMore, onLoadMore, loadMoreLabel, loadingMoreLabel };

  const PaperWithFooter = useMemo(() => {
    const ref = footerRef;
    return function ItemPickerPaper(props: PaperProps) {
      const { children, ...rest } = props;
      const { hasMore: more, loadingMore: loading, onLoadMore: load, loadMoreLabel: moreLabel, loadingMoreLabel: loadingLabel } = ref.current;
      return (
        <Paper {...rest} sx={{ minWidth: 320 }}>
          {children}
          {(more || loading) && (
            <Box sx={{ borderTop: 1, borderColor: "divider" }}>
              <MenuItem
                disabled={loading}
                onMouseDown={(e) => { e.preventDefault(); if (!loading) { load(); } }}
                sx={{ gap: 1, fontSize: "0.8125rem" }}
              >
                {loading && <CircularProgress size={12} color="inherit" />}
                {loading ? loadingLabel : moreLabel}
              </MenuItem>
            </Box>
          )}
        </Paper>
      );
    };
  }, []);

  return (
    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75}>
      {selected.map((item) => (
        <Chip
          key={item.number}
          label={loadingNums.includes(item.number) ? "…" : chipLabel(item)}
          onDelete={() => onRemove(item.number)}
          size="small"
          sx={{
            bgcolor: colorFor(item.number),
            color: "#fff",
            fontWeight: 500,
            "& .MuiChip-deleteIcon": {
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "#fff" },
            },
          }}
        />
      ))}

      {unselected.length > 0 && (
        <Autocomplete<T>
          options={unselected}
          value={null}
          inputValue={inputValue}
          onInputChange={(_, v, reason) => {
            if (reason === "input") { setInputValue(v); }
            else { setInputValue(""); }
          }}
          onChange={(_, item) => {
            if (item) { onAdd(item); }
          }}
          getOptionLabel={(item) => item.title}
          isOptionEqualToValue={(a, b) => a.number === b.number}
          filterOptions={(options, { inputValue: q }) => {
            if (q && hasMore && !loadingMore) { onLoadMore(); }
            const lower = q.toLowerCase();
            return lower ? options.filter((item) => item.title.toLowerCase().includes(lower)) : options;
          }}
          renderOption={(props, item) => {
            const { key, ...rest } = props as typeof props & { key: Key };
            return (
              <Box key={key} component="li" {...rest} sx={{ alignItems: "flex-start !important" }}>
                <Box sx={{ ...DOT_SX, width: 9, height: 9, bgcolor: colorFor(item.number), mr: 1.5, flexShrink: 0, mt: "5px" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.8125rem" }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {caption(item)}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={selected.length === 0 ? emptyPlaceholder : addPlaceholder}
            />
          )}
          slots={{ paper: PaperWithFooter }}
          sx={{ width: selected.length > 0 ? 140 : 220 }}
          disabled={loadingNums.length > 0}
          openOnFocus
          blurOnSelect
        />
      )}
    </Stack>
  );
}

export { ItemPicker };

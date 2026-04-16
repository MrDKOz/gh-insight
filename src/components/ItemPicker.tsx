import type { PaperProps } from "@mui/material/Paper";
import type { Key } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createContext, useContext, useRef, useState } from "react";
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

type FooterData = {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  loadMoreLabel: string;
  loadingMoreLabel: string;
};

// Context lets the module-level PaperWithFooter component read dynamic values
// without being recreated on every render.
const FooterContext = createContext<FooterData>({
  hasMore: false,
  loadingMore: false,
  onLoadMore: () => undefined,
  loadMoreLabel: "",
  loadingMoreLabel: "",
});

const ItemPickerPaper = ({ children, ...rest }: PaperProps) => {
  const { hasMore, loadingMore, onLoadMore, loadMoreLabel, loadingMoreLabel } = useContext(FooterContext);
  return (
    <Paper {...rest} sx={{ minWidth: 320 }}>
      {children}
      {(hasMore || loadingMore) && (
        <Box sx={{ borderTop: 1, borderColor: "divider" }}>
          <ListItemButton
            component="button"
            disabled={loadingMore}
            onMouseDown={(e) => { e.preventDefault(); }}
            onClick={onLoadMore}
            sx={{ gap: 1, fontSize: "0.8125rem", width: "100%" }}
          >
            {loadingMore && <CircularProgress size={12} color="inherit" />}
            {loadingMore ? loadingMoreLabel : loadMoreLabel}
          </ListItemButton>
        </Box>
      )}
    </Paper>
  );
};

const ItemPicker = <T extends BaseItem,>({
  items, selected, loadingNums, hasMore, loadingMore, colorFor,
  onAdd, onRemove, onLoadMore,
  chipLabel, caption, emptyPlaceholder, addPlaceholder, loadMoreLabel, loadingMoreLabel,
}: Props<T>) => {
  const [inputValue, setInputValue] = useState("");
  const unselected = items.filter((item) => !selected.find((s) => s.number === item.number));

  // Keep a stable ref so the context value object is only updated when props change,
  // avoiding unnecessary re-renders of ItemPickerPaper.
  const footerDataRef = useRef<FooterData>({ hasMore, loadingMore, onLoadMore, loadMoreLabel, loadingMoreLabel });
  footerDataRef.current = { hasMore, loadingMore, onLoadMore, loadMoreLabel, loadingMoreLabel };

  return (
    <FooterContext.Provider value={footerDataRef.current}>
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
        {selected.map((item) => (
          <Chip
            key={item.number}
            label={loadingNums.includes(item.number) ? "…" : chipLabel(item)}
            onDelete={() => onRemove(item.number)}
            size="small"
            sx={{
              bgcolor: colorFor(item.number),
              color: "common.white",
              fontWeight: 500,
              "& .MuiChip-deleteIcon": {
                color: "rgba(255,255,255,0.7)",
                "&:hover": { color: "common.white" },
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
            slots={{ paper: ItemPickerPaper }}
            sx={{ width: selected.length > 0 ? 140 : 220 }}
            disabled={loadingNums.length > 0}
            openOnFocus
            blurOnSelect
          />
        )}
      </Stack>
    </FooterContext.Provider>
  );
};

export { ItemPicker };

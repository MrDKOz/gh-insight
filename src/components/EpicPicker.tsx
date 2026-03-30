import type { Epic } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { pluralize } from "../utils/displayUtils";
import { DOT_SX } from "../utils/sxTokens";

type Props = {
  epics: Epic[];
  selected: Epic[];
  loadingNums: number[];
  colorFor: (num: number) => string;
  onAdd: (epic: Epic) => void;
  onRemove: (num: number) => void;
};

const EpicPicker: FunctionComponent<Props> = ({ epics, selected, loadingNums, colorFor, onAdd, onRemove }) => {
  const [inputValue, setInputValue] = useState("");
  const unselected = epics.filter((e) => !selected.find((s) => s.number === e.number));

  return (
    <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75}>
      {selected.map((epic) => (
        <Chip
          key={epic.number}
          label={loadingNums.includes(epic.number) ? "…" : `◆ ${epic.title}`}
          onDelete={() => onRemove(epic.number)}
          size="small"
          sx={{
            bgcolor: colorFor(epic.number),
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
        <Autocomplete<Epic>
          options={unselected}
          value={null}
          inputValue={inputValue}
          onInputChange={(_, v, reason) => {
            if (reason === "input") { setInputValue(v); }
            else { setInputValue(""); }
          }}
          onChange={(_, epic) => {
            if (epic) { onAdd(epic); }
          }}
          getOptionLabel={(e) => e.title}
          isOptionEqualToValue={(a, b) => a.number === b.number}
          filterOptions={(options, { inputValue: q }) => {
            const lower = q.toLowerCase();
            return lower ? options.filter((e) => e.title.toLowerCase().includes(lower)) : options;
          }}
          renderOption={(props, epic) => {
            const { key, ...rest } = props as typeof props & { key: React.Key };
            return (
              <Box key={key} component="li" {...rest} sx={{ alignItems: "flex-start !important" }}>
                <Box sx={{ ...DOT_SX, width: 9, height: 9, bgcolor: colorFor(epic.number), mr: 1.5, flexShrink: 0, mt: "5px" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.8125rem" }}>
                    {epic.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {pluralize(epic.subIssueCount, "sub-issue")} · {epic.state}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={selected.length === 0 ? "Select epic…" : "Add epic…"}
            />
          )}
          sx={{ width: 220 }}
          slotProps={{ paper: { sx: { minWidth: 320 } } }}
          disabled={loadingNums.length > 0}
          openOnFocus
          blurOnSelect
        />
      )}
    </Stack>
  );
};

export { EpicPicker };

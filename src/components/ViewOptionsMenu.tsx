import type { Action } from "../state/appReducer";
import type { View } from "../types/AppTypes";
import type { Dispatch, FunctionComponent } from "react";

import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useCallback, useState } from "react";

type Props = {
  view: View;
  includePRs: { burndown: boolean; cumulativeFlow: boolean; cycleTime: boolean; velocity: boolean };
  showPercentiles: boolean;
  onShowPercentilesChange: () => void;
  dispatch: Dispatch<Action>;
};

const ViewOptionsMenu: FunctionComponent<Props> = ({ view, includePRs, showPercentiles, onShowPercentilesChange, dispatch }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const toggleBurndownPRs       = useCallback(() => { dispatch({ type: "SET_INCLUDE_PRS", chart: "burndown",       value: !includePRs.burndown       }); }, [dispatch, includePRs.burndown]);
  const toggleCycleTimePRs      = useCallback(() => { dispatch({ type: "SET_INCLUDE_PRS", chart: "cycleTime",      value: !includePRs.cycleTime      }); }, [dispatch, includePRs.cycleTime]);
  const toggleVelocityPRs       = useCallback(() => { dispatch({ type: "SET_INCLUDE_PRS", chart: "velocity",       value: !includePRs.velocity       }); }, [dispatch, includePRs.velocity]);
  const toggleCumulativeFlowPRs = useCallback(() => { dispatch({ type: "SET_INCLUDE_PRS", chart: "cumulativeFlow", value: !includePRs.cumulativeFlow }); }, [dispatch, includePRs.cumulativeFlow]);

  const items: { label: string; checked: boolean; onChange: () => void }[] = [];
  if (view === "Burndown")        { items.push({ label: "Include PRs", checked: includePRs.burndown,       onChange: toggleBurndownPRs }); }
  if (view === "Cycle Time")      { items.push({ label: "Include PRs", checked: includePRs.cycleTime,      onChange: toggleCycleTimePRs },
                                                { label: "Show percentiles (p75 / p90)", checked: showPercentiles, onChange: onShowPercentilesChange }); }
  if (view === "Velocity")        { items.push({ label: "Include PRs", checked: includePRs.velocity,       onChange: toggleVelocityPRs }); }
  if (view === "Cumulative Flow") { items.push({ label: "Include PRs", checked: includePRs.cumulativeFlow, onChange: toggleCumulativeFlowPRs }); }

  if (items.length === 0) {return null;}

  return (
    <>
      <Button variant="outlined" size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        View options ▾
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {items.map(({ label, checked, onChange }) => (
          <MenuItem key={label} dense disableRipple sx={{ py: 0, px: 0.5 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={checked} onChange={onChange} sx={{ py: 0.5 }} />}
              label={label}
              sx={{ m: 0, pr: 1, "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export { ViewOptionsMenu };

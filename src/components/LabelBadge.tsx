import type { FunctionComponent } from "react";
import Chip from "@mui/material/Chip";
import { FS, labelTextColor } from "../utils/utils";

type Props = {
  name: string;
  color: string;
};

const LabelBadge: FunctionComponent<Props> = ({ name, color }) => (
  <Chip
    label={name}
    size="small"
    sx={{
      height: 22,
      bgcolor: color,
      color: labelTextColor(color),
      border: "1px solid",
      borderColor: `${color}99`,
      fontWeight: 500,
      fontSize: FS.xs,
    }}
  />
);

export { LabelBadge };

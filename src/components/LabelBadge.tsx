import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import { labelTextColor } from "../utils/utils";

type Props = {
  name: string;
  color: string;
  fontSize?: string;
};

const LabelBadge: FunctionComponent<Props> = ({ name, color, fontSize = "0.5625rem" }) => (
  <Box
    component="span"
    sx={{
      display: "inline-block",
      px: "5px",
      py: "1px",
      borderRadius: "10px",
      fontSize,
      fontWeight: 600,
      bgcolor: color,
      color: labelTextColor(color),
      lineHeight: 1.6,
    }}
  >
    {name}
  </Box>
);

export { LabelBadge };

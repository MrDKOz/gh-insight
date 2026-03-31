import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

type StatProps = {
  value: string;
  label: string;
  title?: string;
  lightColor?: string;
  darkColor?: string;
};

const Stat: FunctionComponent<StatProps> = ({ value, label, title, lightColor, darkColor }) => {
  const inner = (
    <Box sx={{ textAlign: "center" }}>
      <Typography
        variant="h6"
        fontWeight={700}
        lineHeight={1}
        sx={
          lightColor
            ? (theme) => ({ color: theme.palette.mode === "dark" ? (darkColor ?? lightColor) : lightColor })
            : undefined
        }
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: "nowrap", mt: 0.25 }}>
        {label}
      </Typography>
    </Box>
  );

  return title ? (
    <Tooltip title={title} placement="top">
      {inner}
    </Tooltip>
  ) : inner;
};

export { Stat };
export type { StatProps };

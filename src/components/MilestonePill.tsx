import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";

type Props = {
  color: string;
  title: string;
  size?: number;
};

/** Coloured circle dot + milestone title — used in table milestone cells. */
const MilestonePill: FunctionComponent<Props> = ({ color, title, size = 8 }) => (
  <Box
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 0.75,
      fontSize: "0.75rem",
      color: "text.secondary",
      whiteSpace: "nowrap",
    }}
  >
    <Box sx={{ width: size, height: size, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
    {title}
  </Box>
);

export { MilestonePill };

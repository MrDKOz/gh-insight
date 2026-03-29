import type { FunctionComponent, ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type Props = {
  icon: ReactNode;
  title: string;
  message: string;
};

const EmptyState: FunctionComponent<Props> = ({ icon, title, message }) => (
  <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
    <Box sx={{ color: "text.disabled" }}>{icon}</Box>
    <Typography variant="body1" fontWeight={500} color="text.secondary">{title}</Typography>
    <Typography variant="body2" color="text.disabled">{message}</Typography>
  </Box>
);

export { EmptyState };

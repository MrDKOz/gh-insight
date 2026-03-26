import Paper from "@mui/material/Paper";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";
import type { CSSProperties, FunctionComponent, MouseEvent } from "react";

type TagProps = {
  login: string;
  size?: number;
  showName?: boolean;
  prefix?: string;
  onMouseEnter?: (e: MouseEvent<HTMLSpanElement>) => void;
  onMouseLeave?: () => void;
};

const AuthorTag: FunctionComponent<TagProps> = ({
  login,
  size = 20,
  showName = true,
  prefix = "",
  onMouseEnter,
  onMouseLeave,
}) => (
  <span
    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "inherit" }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <img
      src={`https://github.com/${login}.png?size=${size * 2}`}
      alt={login}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: "1.5px solid var(--border)",
        flexShrink: 0,
        cursor: "pointer",
      }}
    />
    {showName && `${prefix}${login}`}
  </span>
);

type CardProps = {
  login: string;
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

const AuthorCard: FunctionComponent<CardProps> = ({ login, style, onMouseEnter, onMouseLeave }) => (
  <Paper
    elevation={3}
    sx={{
      position: "fixed",
      zIndex: 100,
      p: 2,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
      minWidth: 140,
      transform: "translateY(-50%)",
      ...style,
    }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <Box
      component="img"
      src={`https://github.com/${login}.png?size=144`}
      alt={login}
      sx={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: 1, borderColor: "divider" }}
    />
    <Box sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>@{login}</Box>
    <Link
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noreferrer"
      underline="hover"
      sx={{ fontSize: "0.75rem", fontWeight: 500 }}
    >
      View profile →
    </Link>
  </Paper>
);

export { AuthorTag, AuthorCard };

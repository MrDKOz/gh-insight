import type { CSSProperties, FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { FS, safeUrl } from "../utils/displayUtils";

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
  <Box
    component="span"
    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.base, color: "inherit" }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <Box
      component="img"
      src={`https://github.com/${login}.png?size=${size * 2}`}
      alt={showName ? "" : login}
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
  </Box>
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
      alt=""
      sx={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: 1, borderColor: "divider" }}
    />
    <Box sx={{ fontSize: FS.md, fontWeight: 600 }}>@{login}</Box>
    <Link
      href={safeUrl(`https://github.com/${login}`)}
      target="_blank"
      rel="noreferrer"
      underline="hover"
      sx={{ fontSize: FS.base, fontWeight: 500 }}
    >
      View profile →
    </Link>
  </Paper>
);

/** Micro-label ("by" / "assigned") shown above an AuthorTag when both author and assignees are present. */
const RoleLabel: FunctionComponent<{ text: string }> = ({ text }) => (
  <Typography
    sx={{
      fontSize: FS.tiny,
      color: "text.disabled",
      fontWeight: 600,
      lineHeight: 1,
      mb: "2px",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}
  >
    {text}
  </Typography>
);

export { AuthorCard, AuthorTag, RoleLabel };

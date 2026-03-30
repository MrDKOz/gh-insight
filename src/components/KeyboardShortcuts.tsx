import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

type ShortcutRow = {
  keys: string[];
  description: string;
};

const SHORTCUTS: ShortcutRow[] = [
  { keys: ["?"],              description: "Show keyboard shortcuts" },
  { keys: ["Scroll wheel"],   description: "Zoom in / out (Gantt view)" },
  { keys: ["Enter", "Space"], description: "Open in GitHub (focused chart dot or Gantt bar)" },
  { keys: ["↑", "↓"],         description: "Navigate list rows" },
  { keys: ["←", "→"],         description: "Navigate Gantt timeline" },
  { keys: ["Escape"],         description: "Close dialogs / panels" },
];

const KeyChip: FunctionComponent<{ label: string }> = ({ label }) => (
  <Box
    component="kbd"
    sx={(theme) => ({
      display: "inline-block",
      px: 0.75,
      py: 0.25,
      borderRadius: "4px",
      border: `1px solid ${theme.palette.divider}`,
      bgcolor: theme.palette.mode === "dark" ? "grey.800" : "grey.100",
      color: "text.primary",
      fontFamily: "monospace",
      fontSize: "0.75rem",
      lineHeight: 1.6,
      whiteSpace: "nowrap",
    })}
  >
    {label}
  </Box>
);

const KeyboardShortcuts: FunctionComponent = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "?") { return; }
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) { return; }
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="xs"
      fullWidth
      aria-labelledby="keyboard-shortcuts-title"
    >
      <DialogTitle id="keyboard-shortcuts-title" sx={{ fontWeight: 700 }}>
        Keyboard shortcuts
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {SHORTCUTS.map(({ keys, description }, idx) => (
          <Box
            key={description}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              px: 2.5,
              py: 1,
              borderBottom: idx < SHORTCUTS.length - 1 ? `1px solid ${theme.palette.divider}` : "none",
            })}
          >
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 1 }}>
              {description}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, alignItems: "center" }}>
              {keys.map((k, ki) => (
                <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {ki > 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1 }}>or</Typography>
                  )}
                  <KeyChip label={k} />
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
};

export { KeyboardShortcuts };

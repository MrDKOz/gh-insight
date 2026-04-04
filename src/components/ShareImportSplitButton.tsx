import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import { encodeShareCode } from "../utils/urlUtils";

type Props = {
  onImportCode: (code: string) => Promise<void>;
};

const ShareImportSplitButton: FunctionComponent<Props> = ({ onImportCode }) => {
  const [copyTooltip, setCopyTooltip]         = useState<"idle" | "copied">("idle");
  const [shareMenuAnchor, setShareMenuAnchor] = useState<HTMLElement | null>(null);
  const [importOpen, setImportOpen]           = useState(false);
  const [importCode, setImportCode]           = useState("");
  const [importError, setImportError]         = useState("");
  const [clipboardError, setClipboardError]   = useState<string | null>(null);

  const closeImport = () => { setImportOpen(false); setImportCode(""); setImportError(""); };

  const handleImport = () => {
    void onImportCode(importCode.trim())
      .then(closeImport)
      .catch(() => { setImportError("Invalid share code — please check and try again."); });
  };

  return (
    <>
      <ButtonGroup variant="outlined" size="small" disableElevation>
        <Tooltip
          title={copyTooltip === "copied" ? "Copied!" : "Copy share code"}
          placement="bottom"
          onClose={() => setCopyTooltip("idle")}
        >
          <Button
            aria-label="Copy share code to clipboard"
            onClick={() => {
              void navigator.clipboard
                .writeText(encodeShareCode())
                .then(() => { setCopyTooltip("copied"); })
                .catch(() => { setClipboardError("Could not copy — please copy the share code manually."); });
            }}
          >
            {copyTooltip === "copied" ? "Copied!" : "Share"}
          </Button>
        </Tooltip>
        <Button
          aria-label="Share options"
          onClick={(e) => setShareMenuAnchor(e.currentTarget)}
          sx={{ px: 0.75, minWidth: "auto" }}
        >
          ▾
        </Button>
      </ButtonGroup>

      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={() => setShareMenuAnchor(null)}
      >
        <MenuItem dense onClick={() => {
          setShareMenuAnchor(null);
          void navigator.clipboard
            .writeText(window.location.href)
            .catch(() => { setClipboardError("Could not copy — please copy the URL manually."); });
        }}>
          Copy link
        </MenuItem>
        <MenuItem dense onClick={() => { setShareMenuAnchor(null); setImportOpen(true); }}>
          Import code…
        </MenuItem>
      </Menu>

      <Dialog open={importOpen} onClose={closeImport} maxWidth="xs" fullWidth>
        <DialogTitle>Import share code</DialogTitle>
        <DialogContent>
          <TextField
            size="small"
            multiline
            rows={3}
            fullWidth
            placeholder="Paste share code (gmt:…)"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            error={Boolean(importError)}
            helperText={importError || undefined}
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImport}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={!importCode.trim()}>Apply</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={clipboardError !== null}
        autoHideDuration={5000}
        onClose={() => setClipboardError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setClipboardError(null)} sx={{ width: "100%" }}>
          {clipboardError}
        </Alert>
      </Snackbar>
    </>
  );
};

export { ShareImportSplitButton };

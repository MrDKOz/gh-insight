import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

type FetchItem = {
  name: string;
  done: boolean;
};

type Props = {
  /** All selected items (milestones + epics) with their load status. */
  items: FetchItem[];
};

const CheckIcon: FunctionComponent = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FetchingOverlay: FunctionComponent<Props> = ({ items }) => {
  const total    = items.length;
  const loaded   = items.filter((i) => i.done).length;
  const progress = total > 0 ? (loaded / total) * 100 : 0;
  const showList = total > 1;

  const heading = total === 1
    ? `Loading ${items[0]?.name ?? "data"}`
    : "Loading data";

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={showList ? `Loading data, ${loaded} of ${total} items complete` : "Loading data"}
      sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        width: "100%",
        maxWidth: 400,
        px: 3,
        textAlign: "center",
      }}>

        <CircularProgress size={64} thickness={2.5} />

        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{heading}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Fetching issues and pull requests from GitHub
          </Typography>
        </Box>

        {showList && (
          <Box sx={{ width: "100%", border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
            {items.map((item, idx) => (
              <Box
                key={item.name}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  borderTop: idx > 0 ? 1 : 0,
                  borderColor: "divider",
                  transition: "opacity 0.3s",
                  opacity: item.done ? 0.4 : 1,
                }}
              >
                <Box sx={{
                  width: 20, height: 20,
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "success.main",
                }}>
                  {item.done
                    ? <CheckIcon />
                    : <CircularProgress size={14} thickness={4} />
                  }
                </Box>
                <Typography variant="body2" sx={{ fontWeight: item.done ? 400 : 500, textAlign: "left" }}>
                  {item.name}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {showList && (
          <Box sx={{ width: "100%" }}>
            <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 6 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
              {loaded} of {total} loaded
            </Typography>
          </Box>
        )}

      </Box>
    </Box>
  );
};

export { FetchingOverlay };
export type { FetchItem };

import { useReducer, useState, useMemo, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import { fetchMilestones, fetchMilestoneItems } from './github';
import type { Milestone, TimelineItem } from './types';
import Timeline from './Timeline';
import MilestonePicker from './MilestonePicker';
import { muiLightTheme, muiDarkTheme } from './theme';
import {
  DEMO_MILESTONE,   DEMO_ITEMS,
  DEMO_MILESTONE_2, DEMO_ITEMS_2,
  DEMO_MILESTONE_3, DEMO_ITEMS_3,
} from './demo';

const LS_TOKEN = 'gmt_token';
const LS_OWNER = 'gmt_owner';
const LS_REPO  = 'gmt_repo';
const LS_DARK  = 'gmt_dark';

const MILESTONE_COLORS = ['#0969da', '#8250df', '#1a7f37', '#d97706', '#cf222e', '#0550ae'];

// Runs once at module load — applies saved theme before first paint, no FOUC.
function initDark(): boolean {
  const isDark = localStorage.getItem(LS_DARK) !== 'false';
  document.body.classList.toggle('dark', isDark);
  return isDark;
}
const INITIAL_DARK = initDark();

// ---------------------------------------------------------------------------
// Reducer — all milestone-related state in one place
// ---------------------------------------------------------------------------

interface MilestoneState {
  milestones:  Milestone[];
  selected:    Milestone[];
  itemsCache:  Record<number, TimelineItem[]>;
  loadingNums: number[];
  loadingList: boolean;
  isDemo:      boolean;
  error:       string | null;
}

type Action =
  | { type: 'FETCH_LIST_START' }
  | { type: 'FETCH_LIST_SUCCESS';  milestones: Milestone[] }
  | { type: 'FETCH_LIST_EMPTY' }
  | { type: 'FETCH_LIST_ERROR';    error: string }
  | { type: 'SELECT_MILESTONE';    milestone: Milestone }
  | { type: 'FETCH_ITEMS_START';   milestoneNumber: number }
  | { type: 'FETCH_ITEMS_SUCCESS'; milestoneNumber: number; items: TimelineItem[] }
  | { type: 'FETCH_ITEMS_ERROR';   milestoneNumber: number; error: string }
  | { type: 'REMOVE_MILESTONE';      milestoneNumber: number }
  | { type: 'REFRESH_ITEMS_ERROR';   milestoneNumber: number; error: string }
  | { type: 'LOAD_DEMO';             milestones: Milestone[]; selected: Milestone[]; itemsCache: Record<number, TimelineItem[]> };

const initialState: MilestoneState = {
  milestones:  [],
  selected:    [],
  itemsCache:  {},
  loadingNums: [],
  loadingList: false,
  isDemo:      false,
  error:       null,
};

function milestoneReducer(state: MilestoneState, action: Action): MilestoneState {
  switch (action.type) {
    case 'FETCH_LIST_START':
      return { ...initialState, loadingList: true };

    case 'FETCH_LIST_SUCCESS':
      return { ...state, milestones: action.milestones, loadingList: false };

    case 'FETCH_LIST_EMPTY':
      return { ...state, loadingList: false, error: 'No milestones found for this repository.' };

    case 'FETCH_LIST_ERROR':
      return { ...state, loadingList: false, error: action.error };

    case 'SELECT_MILESTONE':
      return { ...state, selected: [...state.selected, action.milestone], error: null };

    case 'FETCH_ITEMS_START':
      return { ...state, loadingNums: [...state.loadingNums, action.milestoneNumber] };

    case 'FETCH_ITEMS_SUCCESS': {
      const title = state.milestones.find(m => m.number === action.milestoneNumber)?.title
        ?? String(action.milestoneNumber);
      return {
        ...state,
        itemsCache:  { ...state.itemsCache, [action.milestoneNumber]: action.items },
        loadingNums: state.loadingNums.filter(n => n !== action.milestoneNumber),
        error: action.items.length === 0
          ? `No items found in milestone "${title}".`
          : state.error,
      };
    }

    case 'FETCH_ITEMS_ERROR':
      return {
        ...state,
        selected:    state.selected.filter(m => m.number !== action.milestoneNumber),
        loadingNums: state.loadingNums.filter(n => n !== action.milestoneNumber),
        error: action.error,
      };

    case 'REMOVE_MILESTONE':
      return { ...state, selected: state.selected.filter(m => m.number !== action.milestoneNumber) };

    case 'REFRESH_ITEMS_ERROR':
      // Keep the milestone selected (stale data stays visible); just surface the error.
      return {
        ...state,
        loadingNums: state.loadingNums.filter(n => n !== action.milestoneNumber),
        error: action.error,
      };

    case 'LOAD_DEMO':
      return {
        milestones:  action.milestones,
        selected:    action.selected,
        itemsCache:  action.itemsCache,
        loadingNums: [],
        loadingList: false,
        isDemo:      true,
        error:       null,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function App() {
  const [dark, setDark]   = useState(INITIAL_DARK);
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) ?? '');
  const [owner, setOwner] = useState(() => localStorage.getItem(LS_OWNER) ?? '');
  const [repo, setRepo]   = useState(() => localStorage.getItem(LS_REPO)  ?? '');

  const [state, dispatch] = useReducer(milestoneReducer, initialState);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(LS_DARK, String(next));
    document.body.classList.toggle('dark', next);
  };

  const milestoneColorFor = useCallback((num: number) => {
    const idx = state.milestones.findIndex(m => m.number === num);
    return MILESTONE_COLORS[Math.max(0, idx) % MILESTONE_COLORS.length];
  }, [state.milestones]);

  const loadMilestones = async () => {
    if (!token || !owner || !repo) return;
    dispatch({ type: 'FETCH_LIST_START' });
    try {
      const milestones = await fetchMilestones(owner, repo, token);
      dispatch(milestones.length === 0
        ? { type: 'FETCH_LIST_EMPTY' }
        : { type: 'FETCH_LIST_SUCCESS', milestones });
    } catch (e) {
      dispatch({ type: 'FETCH_LIST_ERROR', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const addMilestone = useCallback(async (ms: Milestone) => {
    if (state.selected.some(m => m.number === ms.number)) return;
    dispatch({ type: 'SELECT_MILESTONE', milestone: ms });
    if (!(ms.number in state.itemsCache)) {
      dispatch({ type: 'FETCH_ITEMS_START', milestoneNumber: ms.number });
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number);
        dispatch({ type: 'FETCH_ITEMS_SUCCESS', milestoneNumber: ms.number, items });
      } catch (e) {
        dispatch({ type: 'FETCH_ITEMS_ERROR', milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }, [state.selected, state.itemsCache, owner, repo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: 'REMOVE_MILESTONE', milestoneNumber: num });
  }, []);

  const refreshMilestones = useCallback(async () => {
    if (state.selected.length === 0) return;
    state.selected.forEach(ms =>
      dispatch({ type: 'FETCH_ITEMS_START', milestoneNumber: ms.number }),
    );
    await Promise.all(state.selected.map(async ms => {
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number);
        dispatch({ type: 'FETCH_ITEMS_SUCCESS', milestoneNumber: ms.number, items });
      } catch (e) {
        dispatch({ type: 'REFRESH_ITEMS_ERROR', milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }, [state.selected, owner, repo, token]);

  const loadDemo = () => dispatch({
    type:       'LOAD_DEMO',
    milestones: [DEMO_MILESTONE, DEMO_MILESTONE_2, DEMO_MILESTONE_3],
    selected:   [DEMO_MILESTONE],
    itemsCache: {
      [DEMO_MILESTONE.number]:   DEMO_ITEMS,
      [DEMO_MILESTONE_2.number]: DEMO_ITEMS_2,
      [DEMO_MILESTONE_3.number]: DEMO_ITEMS_3,
    },
  });

  const canLoad = !!token && !!owner && !!repo;

  const allItems = useMemo(
    () => state.selected.flatMap(ms => state.itemsCache[ms.number] ?? []),
    [state.selected, state.itemsCache],
  );

  const milestonesMeta = useMemo(
    () => state.selected.map(ms => ({
      number: ms.number,
      title:  ms.title,
      color:  milestoneColorFor(ms.number),
    })),
    [state.selected, milestoneColorFor],
  );

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>GitHub Milestone Dashboard</Typography>
          <IconButton onClick={toggleDark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} size="small">
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2"  x2="12" y2="5"  />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
                <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                <line x1="2"  y1="12" x2="5"  y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
                <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </IconButton>
        </Stack>

        {/* Settings panel */}
        <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <Stack direction="row" alignItems="flex-end" gap={2} flexWrap="wrap">
            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>GitHub Token</Typography>
              <TextField
                type="password"
                value={token}
                onChange={e => { setToken(e.target.value); localStorage.setItem(LS_TOKEN, e.target.value); }}
                placeholder="ghp_... or fine-grained token"
                size="small"
                sx={{ width: 280 }}
                onKeyDown={e => e.key === 'Enter' && loadMilestones()}
              />
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Repository</Typography>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <TextField
                  value={owner}
                  onChange={e => { setOwner(e.target.value); localStorage.setItem(LS_OWNER, e.target.value); }}
                  placeholder="owner"
                  size="small"
                  sx={{ width: 130 }}
                  onKeyDown={e => e.key === 'Enter' && loadMilestones()}
                />
                <Typography color="text.secondary" fontWeight={700}>/</Typography>
                <TextField
                  value={repo}
                  onChange={e => { setRepo(e.target.value); localStorage.setItem(LS_REPO, e.target.value); }}
                  placeholder="repo"
                  size="small"
                  sx={{ width: 130 }}
                  onKeyDown={e => e.key === 'Enter' && loadMilestones()}
                />
              </Stack>
            </Box>

            <Button variant="contained" onClick={loadMilestones} disabled={!canLoad || state.loadingList}>
              {state.loadingList ? 'Loading…' : 'Load Milestones'}
            </Button>
            <Button variant="outlined" onClick={loadDemo}>Load demo</Button>
          </Stack>

          {state.milestones.length > 0 && (
            <Stack direction="row" alignItems="flex-end" gap={2} flexWrap="wrap">
              <MilestonePicker
                milestones={state.milestones}
                selected={state.selected}
                loadingNums={state.loadingNums}
                colorFor={milestoneColorFor}
                onAdd={addMilestone}
                onRemove={removeMilestone}
              />
              {state.selected.length > 0 && !state.isDemo && (
                <Button
                  variant="outlined"
                  onClick={refreshMilestones}
                  disabled={state.loadingNums.length > 0}
                  title="Refetch data for selected milestones"
                >
                  ↻ Refresh
                </Button>
              )}
            </Stack>
          )}
        </Paper>

        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.loadingNums.length > 0 && <Alert severity="info">Loading milestone data…</Alert>}

        {allItems.length > 0 && milestonesMeta.length > 0 && (
          <Timeline items={allItems} milestones={milestonesMeta} />
        )}

      </Box>
    </ThemeProvider>
  );
}

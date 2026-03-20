import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchMilestones, fetchMilestoneItems } from './github';
import type { Milestone, TimelineItem } from './types';
import Timeline from './Timeline';
import MilestonePicker from './MilestonePicker';
import { DEMO_MILESTONE, DEMO_ITEMS, DEMO_MILESTONE_2, DEMO_ITEMS_2, DEMO_MILESTONE_3, DEMO_ITEMS_3 } from './demo';

const LS_TOKEN = 'gmt_token';
const LS_OWNER = 'gmt_owner';
const LS_REPO  = 'gmt_repo';
const LS_DARK  = 'gmt_dark';

const MILESTONE_COLORS = ['#0969da', '#8250df', '#1a7f37', '#d97706', '#cf222e', '#0550ae'];

export default function App() {
  const [dark, setDark]   = useState(() => localStorage.getItem(LS_DARK) !== 'false');
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) ?? '');
  const [owner, setOwner] = useState(() => localStorage.getItem(LS_OWNER) ?? '');
  const [repo, setRepo]   = useState(() => localStorage.getItem(LS_REPO)  ?? '');

  const [milestones, setMilestones]                 = useState<Milestone[]>([]);
  const [selectedMilestones, setSelectedMilestones] = useState<Milestone[]>([]);
  const [milestoneItemsMap, setMilestoneItemsMap]   = useState<Map<number, TimelineItem[]>>(new Map());
  const [loadingNums, setLoadingNums]               = useState<Set<number>>(new Set());
  const [loadingMilestones, setLoadingMilestones]   = useState(false);
  const [error, setError]                           = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_DARK, String(dark));
    document.body.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => { localStorage.setItem(LS_TOKEN, token); }, [token]);
  useEffect(() => { localStorage.setItem(LS_OWNER, owner); }, [owner]);
  useEffect(() => { localStorage.setItem(LS_REPO,  repo);  }, [repo]);

  // Apply saved theme on first render
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const milestoneColorFor = useCallback((num: number) => {
    const idx = milestones.findIndex(m => m.number === num);
    return MILESTONE_COLORS[Math.max(0, idx) % MILESTONE_COLORS.length];
  }, [milestones]);

  const loadMilestones = async () => {
    if (!token || !owner || !repo) return;
    setLoadingMilestones(true);
    setError(null);
    setMilestones([]);
    setSelectedMilestones([]);
    setMilestoneItemsMap(new Map());
    setLoadingNums(new Set());
    try {
      const data = await fetchMilestones(owner, repo, token);
      setMilestones(data);
      if (data.length === 0) setError('No milestones found for this repository.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMilestones(false);
    }
  };

  const addMilestone = async (ms: Milestone) => {
    if (selectedMilestones.find(m => m.number === ms.number)) return;
    setSelectedMilestones(prev => [...prev, ms]);
    setError(null);

    if (!milestoneItemsMap.has(ms.number)) {
      setLoadingNums(prev => new Set([...prev, ms.number]));
      try {
        const data = await fetchMilestoneItems(owner, repo, token, ms.number);
        setMilestoneItemsMap(prev => new Map([...prev, [ms.number, data]]));
        if (data.length === 0) setError(`No items found in milestone "${ms.title}".`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSelectedMilestones(prev => prev.filter(m => m.number !== ms.number));
      } finally {
        setLoadingNums(prev => { const s = new Set(prev); s.delete(ms.number); return s; });
      }
    }
  };

  const removeMilestone = (num: number) => {
    setSelectedMilestones(prev => prev.filter(m => m.number !== num));
  };

  const loadDemo = () => {
    setError(null);
    setMilestones([DEMO_MILESTONE, DEMO_MILESTONE_2, DEMO_MILESTONE_3]);
    setSelectedMilestones([DEMO_MILESTONE, DEMO_MILESTONE_2, DEMO_MILESTONE_3]);
    setMilestoneItemsMap(new Map([
      [DEMO_MILESTONE.number,   DEMO_ITEMS],
      [DEMO_MILESTONE_2.number, DEMO_ITEMS_2],
      [DEMO_MILESTONE_3.number, DEMO_ITEMS_3],
    ]));
    setLoadingNums(new Set());
  };

  const canLoad = !!token && !!owner && !!repo;
  const isLoading = loadingNums.size > 0;

  const allItems = useMemo(
    () => selectedMilestones.flatMap(ms => milestoneItemsMap.get(ms.number) ?? []),
    [selectedMilestones, milestoneItemsMap],
  );

  const milestonesMeta = useMemo(
    () => selectedMilestones.map(ms => ({
      number: ms.number,
      title:  ms.title,
      color:  milestoneColorFor(ms.number),
    })),
    [selectedMilestones, milestoneColorFor],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>GitHub Milestone Dashboard</h1>
        <button className="btn-theme" onClick={() => setDark((d) => !d)} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
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
        </button>
      </header>

      <div className="settings-panel">
        <div className="settings-row">
          <label className="field">
            <span className="field-label">GitHub Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_... or fine-grained token"
              className="input-wide"
              onKeyDown={(e) => e.key === 'Enter' && loadMilestones()}
            />
          </label>

          <label className="field">
            <span className="field-label">Repository</span>
            <div className="repo-group">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="owner"
                onKeyDown={(e) => e.key === 'Enter' && loadMilestones()}
              />
              <span className="repo-sep">/</span>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="repo"
                onKeyDown={(e) => e.key === 'Enter' && loadMilestones()}
              />
            </div>
          </label>

          <button
            onClick={loadMilestones}
            disabled={!canLoad || loadingMilestones}
            className="btn-primary"
          >
            {loadingMilestones ? 'Loading…' : 'Load Milestones'}
          </button>
          <button onClick={loadDemo} className="btn-secondary">
            Load demo
          </button>
        </div>

        {milestones.length > 0 && (
          <div className="settings-row">
            <MilestonePicker
              milestones={milestones}
              selected={selectedMilestones}
              loadingNums={loadingNums}
              colorFor={milestoneColorFor}
              onAdd={addMilestone}
              onRemove={removeMilestone}
            />
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {isLoading && <div className="status-msg">Loading milestone data…</div>}

      {allItems.length > 0 && milestonesMeta.length > 0 && (
        <Timeline items={allItems} milestones={milestonesMeta} />
      )}
    </div>
  );
}

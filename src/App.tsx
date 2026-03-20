import { useState, useEffect } from 'react';
import { fetchMilestones, fetchMilestoneItems } from './github';
import type { Milestone, TimelineItem } from './types';
import Timeline from './Timeline';
import { DEMO_MILESTONE, DEMO_ITEMS } from './demo';

const LS_TOKEN = 'gmt_token';
const LS_OWNER = 'gmt_owner';
const LS_REPO = 'gmt_repo';
const LS_DARK = 'gmt_dark';

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem(LS_DARK) !== 'false');
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) ?? '');
  const [owner, setOwner] = useState(() => localStorage.getItem(LS_OWNER) ?? '');
  const [repo, setRepo] = useState(() => localStorage.getItem(LS_REPO) ?? '');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_DARK, String(dark));
    document.body.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => { localStorage.setItem(LS_TOKEN, token); }, [token]);
  useEffect(() => { localStorage.setItem(LS_OWNER, owner); }, [owner]);
  useEffect(() => { localStorage.setItem(LS_REPO, repo); }, [repo]);

  // Apply saved theme on first render
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMilestones = async () => {
    if (!token || !owner || !repo) return;
    setLoadingMilestones(true);
    setError(null);
    setMilestones([]);
    setItems([]);
    setSelectedMilestone(null);
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

  const handleMilestoneChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const num = parseInt(e.target.value, 10);
    if (isNaN(num)) return;
    const ms = milestones.find((m) => m.number === num) ?? null;
    setSelectedMilestone(ms);
    setItems([]);
    setError(null);
    if (!ms) return;

    setLoadingItems(true);
    try {
      const data = await fetchMilestoneItems(owner, repo, token, num);
      setItems(data);
      if (data.length === 0) setError('No issues found in this milestone.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadDemo = () => {
    setError(null);
    setMilestones([DEMO_MILESTONE]);
    setSelectedMilestone(DEMO_MILESTONE);
    setItems(DEMO_ITEMS);
  };

  const canLoad = !!token && !!owner && !!repo;

  return (
    <div className="app">
      <header className="app-header">
        <h1>GitHub Milestone Timeline</h1>
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
            <label className="field">
              <span className="field-label">Milestone</span>
              <select
                value={selectedMilestone?.number ?? ''}
                onChange={handleMilestoneChange}
                disabled={loadingItems}
                className="input-wide"
              >
                <option value="">Select a milestone…</option>
                {milestones.map((m) => (
                  <option key={m.number} value={m.number}>
                    {m.title} — {m.open_issues + m.closed_issues} issue
                    {m.open_issues + m.closed_issues !== 1 ? 's' : ''} ({m.state})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loadingItems && <div className="status-msg">Loading milestone data…</div>}

      {items.length > 0 && selectedMilestone && (
        <Timeline items={items} title={selectedMilestone.title} />
      )}
    </div>
  );
}

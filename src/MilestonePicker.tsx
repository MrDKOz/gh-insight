import { useState, useRef, useCallback } from 'react';
import type { Milestone } from './types';
import { useOutsideClick } from './hooks';

interface Props {
  milestones:  Milestone[];
  selected:    Milestone[];
  loadingNums: number[];
  colorFor:    (num: number) => string;
  onAdd:       (ms: Milestone) => void;
  onRemove:    (num: number) => void;
}

export default function MilestonePicker({
  milestones, selected, loadingNums, colorFor, onAdd, onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);
  useOutsideClick(menuRef, open, closeMenu);

  const unselected = milestones.filter(m => !selected.find(s => s.number === m.number));

  return (
    <div className="field">
      <span className="field-label">Milestones</span>
      <div className="ms-picker">
        {selected.map(ms => (
          <span
            key={ms.number}
            className="ms-chip"
            style={{ background: colorFor(ms.number) }}
          >
            {loadingNums.includes(ms.number) ? '…' : ms.title}
            <button
              className="ms-chip__remove"
              onClick={() => onRemove(ms.number)}
              aria-label={`Remove ${ms.title}`}
            >
              ×
            </button>
          </span>
        ))}

        {unselected.length > 0 && (
          <div className="ms-add-menu" ref={menuRef}>
            <button
              className="btn-secondary ms-add-btn"
              onClick={() => setOpen(o => !o)}
              disabled={loadingNums.length > 0}
            >
              {selected.length === 0 ? `Select milestone (${unselected.length})` : `+ Add (${unselected.length})`}
            </button>
            {open && (
              <div className="ms-dropdown">
                {unselected.map(ms => (
                  <button
                    key={ms.number}
                    className="ms-option"
                    onClick={() => { onAdd(ms); setOpen(false); }}
                  >
                    <span
                      className="ms-option-dot"
                      style={{ background: colorFor(ms.number) }}
                    />
                    <span className="ms-option-title">{ms.title}</span>
                    <span className="ms-option-meta">
                      {ms.open_issues + ms.closed_issues} issue{ms.open_issues + ms.closed_issues !== 1 ? 's' : ''} ({ms.state})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

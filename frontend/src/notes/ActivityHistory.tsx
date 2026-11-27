import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { formatDateTime } from '../services/formatDate';
import type { ActivityEntry, AppSettings } from '../services/types';

const ACTION_LABELS: Record<string, string> = {
  'note.created': 'created this note',
  'note.moved': 'moved this note',
  'note.resized': 'resized this note',
  'note.recoloured': 'changed the colour',
  'note.content_updated': 'edited the content',
  'note.archived': 'archived this note',
  'note.restored': 'restored this note',
  'note.deleted': 'deleted this note',
  'note.restored_from_bin': 'restored this note from the recycle bin',
  'note.duplicated': 'duplicated this note',
  'note.connected': 'connected this note to another note',
  'note.disconnected': 'removed a connection to another note',
};

export function ActivityHistory({
  noteId,
  dateTimeFormat,
}: {
  noteId: string;
  dateTimeFormat: AppSettings['dateTimeFormat'];
}) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ activity: ActivityEntry[] }>(`/notes/${noteId}/activity`)
      .then(({ activity }) => setEntries(activity))
      .finally(() => setLoading(false));
  }, [noteId]);

  return (
    <div className="activity-history">
      {loading && <p className="full-page-status">Loading…</p>}
      {!loading && entries.length === 0 && <p className="search-dialog__status">No history yet.</p>}
      <ul className="activity-history__list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span
              className="activity-history__dot"
              style={{ background: entry.user.authorColour }}
            />
            <strong>{entry.user.displayName}</strong> {ACTION_LABELS[entry.action] ?? entry.action}
            <span className="activity-history__time">
              {' '}
              — {formatDateTime(entry.createdAt, dateTimeFormat)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

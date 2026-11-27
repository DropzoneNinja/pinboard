import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from './Modal';
import { apiFetch, ApiError, uploadFile } from '../services/api';
import { formatDateTime } from '../services/formatDate';
import { useAppSettings } from '../contexts/AppSettingsContext';
import type { BackupFileInfo, BackupSettings } from '../services/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

const KIND_LABELS: Record<BackupFileInfo['kind'], string> = {
  auto: 'Automatic',
  manual: 'Manual',
  uploaded: 'Uploaded',
};

export function SystemBackupModal({ onClose }: { onClose: () => void }) {
  const { settings: appSettings } = useAppSettings();
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupFileInfo | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function loadAll() {
    return Promise.all([
      apiFetch<{ settings: BackupSettings }>('/backup/settings'),
      apiFetch<{ backups: BackupFileInfo[] }>('/backup/list'),
    ]).then(([s, b]) => {
      setSettings(s.settings);
      setBackups(b.backups);
    });
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    setError(null);
    try {
      const { settings: updated } = await apiFetch<{ settings: BackupSettings }>(
        '/backup/settings',
        {
          method: 'PUT',
          body: {
            enabled: settings.enabled,
            frequency: settings.frequency,
            retainCount: settings.retainCount,
          },
        },
      );
      setSettings(updated);
      setSettingsSaved(true);
    } catch {
      setError('Could not save backup schedule.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleBackupNow() {
    setRunning(true);
    setError(null);
    try {
      await apiFetch('/backup/run', { method: 'POST' });
      await loadAll();
    } catch {
      setError('Could not create a backup.');
    } finally {
      setRunning(false);
    }
  }

  function handleDownload(filename: string) {
    const a = document.createElement('a');
    a.href = `/api/v1/backup/${encodeURIComponent(filename)}/download`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFile(`/backup/upload`, file);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="System backup" onClose={onClose}>
      {loading || !settings ? (
        <p className="full-page-status">Loading…</p>
      ) : (
        <div className="settings-tab">
          <form onSubmit={handleSaveSettings}>
            <label className="field">Automated backups</label>
            <label className="backup-settings__checkbox">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Enabled
            </label>

            <div className="backup-settings__row">
              <div>
                <label className="field">Frequency</label>
                <select
                  className="input"
                  value={settings.frequency}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      frequency: e.target.value as BackupSettings['frequency'],
                    })
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="field">Keep last</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.retainCount}
                  onChange={(e) =>
                    setSettings({ ...settings, retainCount: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            {settings.lastRunAt && (
              <p className="board-settings__hint">
                Last automatic backup:{' '}
                {formatDateTime(settings.lastRunAt, appSettings.dateTimeFormat)}
              </p>
            )}
            {settingsSaved && <p className="settings-tab__success">Saved.</p>}
            <div className="modal-card__actions">
              <button type="submit" className="btn btn--primary" disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </form>

          <hr className="settings-divider" />

          <div className="backup-settings__toolbar">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleBackupNow}
              disabled={running}
            >
              {running ? 'Backing up…' : 'Backup now'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload backup…'}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleUploadFile}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <ul className="search-dialog__list">
            {backups.length === 0 && <p className="search-dialog__status">No backups yet.</p>}
            {backups.map((b) => (
              <li key={b.filename} className="archive-dialog__row">
                <span className="search-dialog__title">{b.filename}</span>
                <span className="search-dialog__board">
                  {KIND_LABELS[b.kind]} · {formatBytes(b.sizeBytes)} ·{' '}
                  {formatDateTime(b.createdAt, appSettings.dateTimeFormat)}
                </span>
                <button className="btn" onClick={() => handleDownload(b.filename)}>
                  Download
                </button>
                <button className="btn recycle-bin__delete" onClick={() => setRestoreTarget(b)}>
                  Restore…
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {restoreTarget && (
        <RestoreConfirmDialog backup={restoreTarget} onClose={() => setRestoreTarget(null)} />
      )}
    </Modal>
  );
}

function RestoreConfirmDialog({
  backup,
  onClose,
}: {
  backup: BackupFileInfo;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore(e: FormEvent) {
    e.preventDefault();
    setRestoring(true);
    setError(null);
    try {
      await apiFetch(`/backup/${encodeURIComponent(backup.filename)}/restore`, {
        method: 'POST',
        body: { password },
      });
      // A full restore wipes every session, including this one — send the user back to login.
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this backup.');
      setRestoring(false);
    }
  }

  return (
    <Modal title="Restore system backup" onClose={onClose}>
      <form onSubmit={handleRestore}>
        <p className="note-editor__conflict">
          This replaces every board, note and user account with the contents of{' '}
          <strong>{backup.filename}</strong>, and signs everyone out. This cannot be undone.
        </p>
        <label className="field">Confirm your password to continue</label>
        <input
          className="input"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-card__actions">
          <button type="button" className="btn" onClick={onClose} disabled={restoring}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn recycle-bin__delete"
            disabled={restoring || !password}
          >
            {restoring ? 'Restoring…' : 'Restore and sign everyone out'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

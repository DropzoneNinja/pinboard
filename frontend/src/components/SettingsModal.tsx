import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { apiFetch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useChangePassword } from '../auth/useChangePassword';
import { NOTE_COLOURS } from '../notes/palette';
import { formatDateTime } from '../services/formatDate';
import type { Session, User } from '../services/types';

type Tab = 'profile' | 'sessions' | 'application';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-tabs">
        <button
          className={tab === 'profile' ? 'settings-tabs__btn--active' : ''}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          className={tab === 'sessions' ? 'settings-tabs__btn--active' : ''}
          onClick={() => setTab('sessions')}
        >
          Sessions
        </button>
        <button
          className={tab === 'application' ? 'settings-tabs__btn--active' : ''}
          onClick={() => setTab('application')}
        >
          Application
        </button>
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'application' && <ApplicationTab />}
    </Modal>
  );
}

function ProfileTab() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [authorColour, setAuthorColour] = useState(user?.authorColour ?? '#3B82F6');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    error: passwordError,
    saving: passwordSaving,
    success: passwordChanged,
    submit: changePassword,
  } = useChangePassword();

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const { user: updated } = await apiFetch<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: { displayName: displayName.trim(), authorColour },
      });
      setUser(updated);
      setProfileMessage('Saved.');
    } catch {
      setProfileMessage('Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    changePassword();
  }

  return (
    <div className="settings-tab">
      <form onSubmit={handleProfileSave}>
        <label className="field">Display name</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
        />

        <label className="field">Author colour</label>
        <input
          className="input"
          type="color"
          value={authorColour}
          onChange={(e) => setAuthorColour(e.target.value)}
          style={{ height: 36, padding: 2 }}
        />

        {profileMessage && <p className="form-error">{profileMessage}</p>}
        <div className="modal-card__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={savingProfile || !displayName.trim()}
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <hr className="settings-divider" />

      <form onSubmit={handlePasswordChange}>
        <label className="field">Current password</label>
        <input
          className="input"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <label className="field">New password</label>
        <input
          className="input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
        />
        {passwordError && <p className="form-error">{passwordError}</p>}
        {passwordChanged && <p className="settings-tab__success">Password changed.</p>}
        <div className="modal-card__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={passwordSaving || !currentPassword || newPassword.length < 8}
          >
            {passwordSaving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ sessions: Session[] }>('/auth/sessions')
      .then(({ sessions }) => setSessions(sessions))
      .finally(() => setLoading(false));
  }, []);

  async function handleRevoke(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeAll() {
    if (!window.confirm('Log out all other sessions? You will stay logged in on this device.'))
      return;
    const others = sessions.filter((s) => !s.isCurrent);
    await Promise.all(
      others.map((s) => apiFetch(`/auth/sessions/${s.id}`, { method: 'DELETE' }).catch(() => {})),
    );
    setSessions((prev) => prev.filter((s) => s.isCurrent));
  }

  return (
    <div className="settings-tab">
      {loading && <p className="full-page-status">Loading…</p>}
      <ul className="search-dialog__list">
        {sessions.map((s) => (
          <li key={s.id} className="archive-dialog__row">
            <span className="search-dialog__title">
              {s.isCurrent ? 'This device' : s.userAgent?.slice(0, 40) || 'Unknown device'}
            </span>
            <span className="search-dialog__board">
              last used {formatDateTime(s.lastUsedAt)} {s.ipAddress ? `· ${s.ipAddress}` : ''}
            </span>
            {!s.isCurrent && (
              <button
                className="btn recycle-bin__delete"
                disabled={busyId === s.id}
                onClick={() => handleRevoke(s.id)}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      {sessions.some((s) => !s.isCurrent) && (
        <div className="modal-card__actions">
          <button className="btn" onClick={handleRevokeAll}>
            Revoke all other sessions
          </button>
        </div>
      )}
    </div>
  );
}

function ApplicationTab() {
  const { settings, updateSettings } = useAppSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        defaultNoteColour: form.defaultNoteColour,
        defaultNoteWidth: form.defaultNoteWidth,
        defaultNoteHeight: form.defaultNoteHeight,
        autosaveDebounceMs: form.autosaveDebounceMs,
        recycleBinRetentionDays: form.recycleBinRetentionDays,
        dateTimeFormat: form.dateTimeFormat,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-tab" onSubmit={handleSave}>
      <label className="field">Default note colour</label>
      <div className="editor-toolbar__swatches" style={{ marginBottom: 12 }}>
        {Object.entries(NOTE_COLOURS).map(([name, hex]) => (
          <button
            key={name}
            type="button"
            className="editor-toolbar__swatch"
            style={{
              background: hex,
              outline:
                form.defaultNoteColour === name ? '2px solid var(--colour-primary)' : undefined,
            }}
            title={name}
            onClick={() => setForm((f) => ({ ...f, defaultNoteColour: name }))}
          />
        ))}
      </div>

      <label className="field">Default note size (px)</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          type="number"
          min={120}
          max={2000}
          value={form.defaultNoteWidth}
          onChange={(e) => setForm((f) => ({ ...f, defaultNoteWidth: Number(e.target.value) }))}
        />
        <input
          className="input"
          type="number"
          min={100}
          max={2000}
          value={form.defaultNoteHeight}
          onChange={(e) => setForm((f) => ({ ...f, defaultNoteHeight: Number(e.target.value) }))}
        />
      </div>

      <label className="field">Autosave delay (ms)</label>
      <input
        className="input"
        type="number"
        min={100}
        max={10000}
        step={100}
        value={form.autosaveDebounceMs}
        onChange={(e) => setForm((f) => ({ ...f, autosaveDebounceMs: Number(e.target.value) }))}
      />

      <label className="field">Recycle bin retention (days)</label>
      <input
        className="input"
        type="number"
        min={1}
        max={3650}
        value={form.recycleBinRetentionDays}
        onChange={(e) =>
          setForm((f) => ({ ...f, recycleBinRetentionDays: Number(e.target.value) }))
        }
      />

      <label className="field">Date/time display</label>
      <select
        className="input"
        value={form.dateTimeFormat}
        onChange={(e) =>
          setForm((f) => ({ ...f, dateTimeFormat: e.target.value as typeof f.dateTimeFormat }))
        }
      >
        <option value="auto">Match browser</option>
        <option value="12h">12-hour</option>
        <option value="24h">24-hour</option>
      </select>

      {saved && <p className="settings-tab__success">Saved.</p>}
      <div className="modal-card__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

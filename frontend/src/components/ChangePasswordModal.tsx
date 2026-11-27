import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './Modal';
import { useChangePassword } from '../auth/useChangePassword';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    error,
    saving,
    success,
    submit,
  } = useChangePassword();
  const [confirmPassword, setConfirmPassword] = useState('');
  const mismatch =
    newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    submit();
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      <form className="settings-tab" onSubmit={handleSubmit}>
        <label className="field">Current password</label>
        <input
          className="input"
          type="password"
          autoFocus
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
        <label className="field">Confirm new password</label>
        <input
          className="input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
        />
        {mismatch && <p className="form-error">New passwords don&rsquo;t match.</p>}
        {error && <p className="form-error">{error}</p>}
        {success && <p className="settings-tab__success">Password changed.</p>}
        <div className="modal-card__actions">
          <button type="button" className="btn" onClick={onClose}>
            {success ? 'Done' : 'Cancel'}
          </button>
          {!success && (
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !currentPassword || newPassword.length < 8 || mismatch}
            >
              {saving ? 'Changing…' : 'Change password'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

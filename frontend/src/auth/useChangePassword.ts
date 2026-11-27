import { useState } from 'react';
import { apiFetch, ApiError } from '../services/api';

/** Shared by the Settings profile tab and the quick-access user menu modal. */
export function useChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setError(null);
    setSuccess(false);
  }

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    error,
    saving,
    success,
    submit,
    reset,
  };
}

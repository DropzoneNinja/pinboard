import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { SettingsModal } from './SettingsModal';
import { SystemBackupModal } from './SystemBackupModal';

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-badge user-badge--button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="user-badge__dot" style={{ background: user.authorColour }} />
        {user.displayName}
        <span className="user-menu__caret">▾</span>
      </button>
      {open && (
        <div className="user-menu__dropdown">
          <button
            type="button"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              setShowSettings(true);
            }}
          >
            Settings
          </button>
          <button
            type="button"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              setShowChangePassword(true);
            }}
          >
            Change password
          </button>
          <button
            type="button"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              setShowBackup(true);
            }}
          >
            System backup
          </button>
          <button
            type="button"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Log out
          </button>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showBackup && <SystemBackupModal onClose={() => setShowBackup(false)} />}
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch } from '../services/api';
import type { AppSettings } from '../services/types';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'global',
  defaultNoteColour: 'yellow',
  defaultNoteWidth: 220,
  defaultNoteHeight: 220,
  autosaveDebounceMs: 700,
  recycleBinRetentionDays: 30,
  dateTimeFormat: 'auto',
  updatedAt: new Date(0).toISOString(),
};

interface AppSettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (fields: Partial<AppSettings>) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ settings: AppSettings }>('/settings')
      .then(({ settings }) => setSettings(settings))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (fields: Partial<AppSettings>) => {
    const { settings } = await apiFetch<{ settings: AppSettings }>('/settings', {
      method: 'PATCH',
      body: fields,
    });
    setSettings(settings);
  }, []);

  const value = useMemo(
    () => ({ settings, loading, updateSettings }),
    [settings, loading, updateSettings],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return ctx;
}

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

// Coalesce concurrent 401s into a single refresh call instead of one per failed request.
let refreshInFlight: Promise<boolean> | null = null;

function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

const NO_RETRY_PATHS = new Set(['/auth/login', '/auth/refresh']);

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...rest,
    });

  let res = await doFetch();

  if (res.status === 401 && !NO_RETRY_PATHS.has(path)) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const doUpload = () => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}${path}`, { method: 'POST', credentials: 'include', body: formData });
  };

  let res = await doUpload();
  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) res = await doUpload();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = data?.error?.message ?? `Upload failed with status ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

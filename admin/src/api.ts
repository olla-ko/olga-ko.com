export type FileEntry = {
  path: string;
  type: "portfolio" | "cv" | "single";
  lang?: "ru" | "en";
  pagePath?: string;
  title: string;
  group: string;
  hasDraft?: boolean;
};

export type Session = { auth: boolean; mode: "github" | "local" };

export type Version = {
  sha: string;
  date: string | null;
  message: string;
  published: boolean;
  isCurrent: boolean;
  viaAdmin: boolean;
};

// счётчик запросов «в полёте» — для глобального индикатора активности
let pendingCount = 0;
const pendingListeners = new Set<(n: number) => void>();
function notifyPending() {
  for (const fn of pendingListeners) fn(pendingCount);
}
export function subscribePending(fn: (n: number) => void) {
  pendingListeners.add(fn);
  fn(pendingCount);
  return () => {
    pendingListeners.delete(fn);
  };
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  pendingCount++;
  notifyPending();
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin": "1",
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    return res.headers.get("content-type")?.includes("json") ? res.json() : (res.text() as Promise<T>);
  } finally {
    pendingCount--;
    notifyPending();
  }
}

export const api = {
  session: () => req<Session>("/api/session"),
  login: (password: string) => req<{ ok: true }>("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: true }>("/api/logout", { method: "POST" }),
  files: () => req<FileEntry[]>("/api/files"),
  file: (path: string, ref: string) =>
    req<{ content: string; sha: string | null }>(`/api/file?path=${encodeURIComponent(path)}&ref=${ref}`),
  versions: (path: string) => req<Version[]>(`/api/versions?path=${encodeURIComponent(path)}`),
  deleteVersion: (path: string, sha: string) =>
    req<{ ok: true }>("/api/version/delete", { method: "POST", body: JSON.stringify({ path, sha }) }),
  preview: (body: { type: string; lang?: string; md: string; pagePath?: string }) =>
    req<string>("/api/preview", { method: "POST", body: JSON.stringify(body) }),
  save: (body: { path: string; content: string; sha?: string | null; target: "main" | "drafts" }) =>
    req<{ ok: true }>("/api/save", { method: "POST", body: JSON.stringify(body) }),
  deploy: () => req<{ status: string; conclusion?: string | null; url?: string }>("/api/deploy"),
  scaffold: (body: { title: string; slug: string }) =>
    req<{ ok: true; path: string }>("/api/scaffold", { method: "POST", body: JSON.stringify(body) }),
};

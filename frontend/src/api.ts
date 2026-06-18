import type {
  ActivityItem,
  ActivityStatsData,
  Settings,
  TestResult,
  Watch,
  WatchRule,
  WatchStats,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface WatchPayload {
  name: string;
  is_active: boolean;
  rules: WatchRule[];
  interval_minutes: number;
  download_client: string;
}

export const api = {
  listWatches: () => request<Watch[]>("/watches"),
  getWatch: (id: number) => request<WatchStats>(`/watches/${id}`),
  createWatch: (payload: WatchPayload) =>
    request<Watch>("/watches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateWatch: (id: number, payload: Partial<WatchPayload>) =>
    request<Watch>(`/watches/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteWatch: (id: number) =>
    request<void>(`/watches/${id}`, { method: "DELETE" }),
  runWatch: (id: number) =>
    request<{ status: string }>(`/watches/${id}/run`, { method: "POST" }),
  togglePause: (id: number) =>
    request<Watch>(`/watches/${id}/pause`, { method: "POST" }),

  listActivity: (params: {
    watch_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.watch_id != null) q.set("watch_id", String(params.watch_id));
    if (params.status) q.set("status", params.status);
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<ActivityItem[]>(`/activity${qs ? `?${qs}` : ""}`);
  },
  activityStats: () => request<ActivityStatsData>("/activity/stats"),
  retryActivity: (id: number) =>
    request<ActivityItem>(`/activity/${id}/retry`, { method: "POST" }),

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (payload: Partial<Settings>) =>
    request<Settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  testSpotweb: (payload: Partial<Settings>) =>
    request<TestResult>("/settings/test-spotweb", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  testDownloadClient: (payload: Partial<Settings>) =>
    request<TestResult>("/settings/test-download-client", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

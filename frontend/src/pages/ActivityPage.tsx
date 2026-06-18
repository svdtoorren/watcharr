import { useEffect, useState } from "react";
import { api } from "../api";
import type { ActivityItem, Watch } from "../types";
import { formatSize, relativeTime } from "../utils";

type Tab = "history" | "queue";

const GRID = "2.6fr 1.3fr 90px 110px 170px";

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>("history");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [watchFilter, setWatchFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const params: { watch_id?: number; status?: string; limit: number } = {
        limit: 200,
      };
      if (watchFilter) params.watch_id = Number(watchFilter);
      if (statusFilter) params.status = statusFilter;
      setItems(await api.listActivity(params));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    }
  }

  useEffect(() => {
    api.listWatches().then(setWatches).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchFilter, statusFilter]);

  async function retry(id: number) {
    try {
      await api.retryActivity(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opnieuw versturen mislukt");
    }
  }

  // The "queue" represents items still pending — failed items awaiting retry.
  const queueCount = (items ?? []).filter((i) => i.status === "failed").length;
  const visible =
    tab === "queue" ? (items ?? []).filter((i) => i.status === "failed") : items ?? [];

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Activity</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="tabs">
          <button
            className={`tab${tab === "history" ? " active" : ""}`}
            onClick={() => setTab("history")}
          >
            Geschiedenis
          </button>
          <button
            className={`tab${tab === "queue" ? " active" : ""}`}
            onClick={() => setTab("queue")}
          >
            Wachtrij
            {queueCount > 0 && <span className="tab-badge">{queueCount}</span>}
          </button>
          <div className="tab-filters">
            filter:
            <select
              value={watchFilter}
              onChange={(e) => setWatchFilter(e.target.value)}
            >
              <option value="">alle watches</option>
              {watches.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">alle statussen</option>
              <option value="sent">verzonden</option>
              <option value="skipped_duplicate">overgeslagen</option>
              <option value="failed">mislukt</option>
            </select>
          </div>
        </div>

        <div className="data-head" style={{ gridTemplateColumns: GRID }}>
          <div>Titel</div>
          <div>Watch</div>
          <div>Grootte</div>
          <div>Tijd</div>
          <div>Status</div>
        </div>

        {items === null ? (
          <div className="center-pad">
            <span className="spinner" /> laden…
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            {tab === "queue"
              ? "Geen items in de wachtrij."
              : "Nog geen activiteit."}
          </div>
        ) : (
          visible.map((it) => (
            <div
              key={it.id}
              className={`data-row${it.status === "skipped_duplicate" ? " muted" : ""}`}
              style={{ gridTemplateColumns: GRID }}
            >
              <div>{it.spot_title}</div>
              <div className="cell-sub">{it.watch_name}</div>
              <div>{formatSize(it.spot_size_bytes)}</div>
              <div>{relativeTime(it.sent_at)}</div>
              <div>
                {it.status === "sent" && (
                  <span className="status-sent">→ verzonden</span>
                )}
                {it.status === "skipped_duplicate" && (
                  <span className="status-skipped">↺ overgeslagen (dubbel)</span>
                )}
                {it.status === "failed" && (
                  <span className="status-failed">
                    ✕ mislukt —{" "}
                    <button className="retry-link" onClick={() => retry(it.id)}>
                      opnieuw?
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

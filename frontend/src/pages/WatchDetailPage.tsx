import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type WatchPayload } from "../api";
import AddEditWatchModal from "../modals/AddEditWatchModal";
import StatusDot from "../components/StatusDot";
import type { ActivityItem, WatchStats } from "../types";
import {
  formatInterval,
  formatSize,
  isNegativeRule,
  relativeTime,
  ruleChipLabel,
} from "../utils";

const DAYS = 30;

function buildChart(items: ActivityItem[]): number[] {
  const buckets = new Array(DAYS).fill(0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (const it of items) {
    if (it.status !== "sent") continue;
    const d = new Date(it.sent_at.endsWith("Z") ? it.sent_at : `${it.sent_at}Z`);
    d.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < DAYS) buckets[DAYS - 1 - diff] += 1;
  }
  return buckets;
}

export default function WatchDetailPage() {
  const { id } = useParams();
  const watchId = Number(id);
  const navigate = useNavigate();
  const [watch, setWatch] = useState<WatchStats | null>(null);
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const [w, activity] = await Promise.all([
        api.getWatch(watchId),
        api.listActivity({ watch_id: watchId, limit: 200 }),
      ]);
      setWatch(w);
      setRecent(activity);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchId]);

  const chart = useMemo(() => buildChart(recent), [recent]);
  const chartMax = Math.max(1, ...chart);

  if (error) return <div className="error-banner">{error}</div>;
  if (!watch)
    return (
      <div className="center-pad">
        <span className="spinner" /> laden…
      </div>
    );

  async function handleSave(payload: WatchPayload) {
    await api.updateWatch(watchId, payload);
    setEditing(false);
    await load();
  }

  async function handleRun() {
    await api.runWatch(watchId);
    setTimeout(load, 1500);
  }

  async function handlePause() {
    await api.togglePause(watchId);
    await load();
  }

  async function handleDelete() {
    if (!confirm("Deze Watch verwijderen?")) return;
    await api.deleteWatch(watchId);
    navigate("/");
  }

  return (
    <div>
      <button className="btn btn-sm" onClick={() => navigate("/")} style={{ marginBottom: 16 }}>
        ← Watches
      </button>

      <div className="card card-pad">
        <div className="detail-head">
          <div className="detail-title-wrap">
            <StatusDot active={watch.is_active} />
            <span className="detail-title">{watch.name}</span>
            <span className="detail-meta">
              {watch.is_active ? "actief" : "gepauzeerd"} · elke{" "}
              {formatInterval(watch.interval_minutes)}
            </span>
          </div>
          <div className="detail-actions">
            <button className="btn btn-sm" onClick={handleRun}>
              Nu uitvoeren
            </button>
            <button className="btn btn-sm" onClick={handlePause}>
              {watch.is_active ? "Pauzeren" : "Hervatten"}
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Bewerken
            </button>
            <button className="btn btn-sm btn-danger" onClick={handleDelete}>
              Verwijderen
            </button>
          </div>
        </div>

        <div className="chips" style={{ marginBottom: 20 }}>
          {watch.rules.map((r, i) => (
            <span key={i} className={`chip${isNegativeRule(r) ? " negative" : ""}`}>
              {ruleChipLabel(r)}
            </span>
          ))}
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{watch.total_sent}</div>
            <div className="stat-label">totaal verzonden</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{watch.this_week}</div>
            <div className="stat-label">deze week</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {watch.avg_size_mb}
              <span style={{ fontSize: 16 }}> MB</span>
            </div>
            <div className="stat-label">gem. grootte</div>
          </div>
          <div className="stat-card">
            <div className="stat-value danger">{watch.failed_count}</div>
            <div className="stat-label">mislukt</div>
          </div>
          <div className="stat-card">
            <div className="stat-value small">{relativeTime(watch.last_run_at)}</div>
            <div className="stat-label">laatste run</div>
          </div>
        </div>

        <div className="section-label">Verzonden per dag (laatste 30 dagen)</div>
        <div className="chart">
          {chart.map((v, i) => (
            <div
              key={i}
              className="bar"
              style={{ height: `${(v / chartMax) * 100}%` }}
              title={`${v} verzonden`}
            />
          ))}
        </div>

        <div className="section-label">Recent verzonden</div>
        <div className="data-table">
          <div
            className="data-head"
            style={{ gridTemplateColumns: "3fr 90px 1.4fr 110px 160px" }}
          >
            <div>Titel</div>
            <div>Grootte</div>
            <div>Categorie</div>
            <div>Tijd</div>
            <div>Status</div>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">Nog niets verzonden.</div>
          ) : (
            recent.slice(0, 25).map((it) => (
              <div
                key={it.id}
                className={`data-row${it.status === "skipped_duplicate" ? " muted" : ""}`}
                style={{ gridTemplateColumns: "3fr 90px 1.4fr 110px 160px" }}
              >
                <div>{it.spot_title}</div>
                <div>{formatSize(it.spot_size_bytes)}</div>
                <div>{it.spot_category}</div>
                <div>{relativeTime(it.sent_at)}</div>
                <div>
                  {it.status === "sent" && (
                    <span className="status-sent">→ verzonden</span>
                  )}
                  {it.status === "skipped_duplicate" && (
                    <span className="status-skipped">↺ overgeslagen (dubbel)</span>
                  )}
                  {it.status === "failed" && (
                    <span className="status-failed">✕ mislukt</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <AddEditWatchModal
          initial={watch}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type WatchPayload } from "../api";
import AddEditWatchModal from "../modals/AddEditWatchModal";
import StatusDot from "../components/StatusDot";
import type { Watch } from "../types";
import { formatInterval, isNegativeRule, relativeTime, ruleChipLabel } from "../utils";

export default function WatchesPage() {
  const navigate = useNavigate();
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Watch | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  async function load() {
    try {
      setWatches(await api.listWatches());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!watches) return [];
    const q = search.toLowerCase().trim();
    if (!q) return watches;
    return watches.filter((w) => w.name.toLowerCase().includes(q));
  }, [watches, search]);

  async function handleSave(payload: WatchPayload) {
    if (editing) {
      await api.updateWatch(editing.id, payload);
    } else {
      await api.createWatch(payload);
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleRun(id: number) {
    setOpenMenu(null);
    await api.runWatch(id);
    setTimeout(load, 1500);
  }

  async function handlePause(id: number) {
    setOpenMenu(null);
    await api.togglePause(id);
    await load();
  }

  async function handleDelete(id: number) {
    setOpenMenu(null);
    if (!confirm("Deze Watch verwijderen?")) return;
    await api.deleteWatch(id);
    await load();
  }

  return (
    <div onClick={() => setOpenMenu(null)}>
      <div className="page-head">
        <div className="page-title">Watches</div>
        <div className="head-actions">
          <div className="search">
            <span className="search-icon" />
            <input
              placeholder="zoeken…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Watch toevoegen
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="table-head">
          <div />
          <div>Naam</div>
          <div>Filters</div>
          <div>Interval</div>
          <div>Laatste run</div>
          <div>Verzonden</div>
          <div />
        </div>

        {watches === null ? (
          <div className="center-pad">
            <span className="spinner" /> laden…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search
              ? "Geen Watches gevonden."
              : "Nog geen Watches. Voeg er één toe om te beginnen."}
          </div>
        ) : (
          filtered.map((w) => (
            <div
              key={w.id}
              className={`table-row clickable${w.is_active ? "" : " paused"}`}
              onClick={() => navigate(`/watches/${w.id}`)}
            >
              <div>
                <StatusDot active={w.is_active} />
              </div>
              <div className="cell-name">{w.name}</div>
              <div className="chips">
                {w.rules.map((r, i) => (
                  <span
                    key={i}
                    className={`chip${isNegativeRule(r) ? " negative" : ""}`}
                  >
                    {ruleChipLabel(r)}
                  </span>
                ))}
              </div>
              <div>{formatInterval(w.interval_minutes)}</div>
              <div className="cell-sub">
                {w.is_active ? relativeTime(w.last_run_at) : "gepauzeerd"}
              </div>
              <div className="cell-sent">{w.total_sent}</div>
              <div
                className="menu-wrap"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === w.id ? null : w.id);
                }}
              >
                <button className="menu-btn" aria-label="Acties">
                  ⋯
                </button>
                {openMenu === w.id && (
                  <div className="menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditing(w);
                        setModalOpen(true);
                        setOpenMenu(null);
                      }}
                    >
                      Bewerken
                    </button>
                    <button onClick={() => handlePause(w.id)}>
                      {w.is_active ? "Pauzeren" : "Hervatten"}
                    </button>
                    <button onClick={() => handleRun(w.id)}>Nu uitvoeren</button>
                    <button className="danger" onClick={() => handleDelete(w.id)}>
                      Verwijderen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <AddEditWatchModal
          initial={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

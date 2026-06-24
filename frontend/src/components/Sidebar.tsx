import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";

export default function Sidebar() {
  const [spotwebOk, setSpotwebOk] = useState<boolean | null>(null);

  useEffect(() => {
    // Light connection check for the footer status dot.
    api
      .getSettings()
      .then((s) => api.testSpotweb(s))
      .then((r) => setSpotwebOk(r.ok))
      .catch(() => setSpotwebOk(false));
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <span />
        </span>
        <span className="brand-name">Watcharr</span>
      </div>

      <NavLink to="/" end className="nav-link">
        <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Watches
      </NavLink>
      <NavLink to="/activity" className="nav-link">
        <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Activity
      </NavLink>

      <div className="nav-divider" />

      <NavLink to="/settings" className="nav-link">
        <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Instellingen
      </NavLink>

      <div className="sidebar-footer">
        v0.1 ·
        <span
          className={`status-dot ${spotwebOk ? "ok" : spotwebOk === false ? "bad" : "paused"}`}
          title={spotwebOk ? "Spotweb verbonden" : "Spotweb niet verbonden"}
        />
        {spotwebOk ? "verbonden" : spotwebOk === false ? "offline" : "…"}
      </div>
    </nav>
  );
}

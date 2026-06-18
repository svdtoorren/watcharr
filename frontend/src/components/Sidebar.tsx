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
        <span className="nav-icon square" /> Watches
      </NavLink>
      <NavLink to="/activity" className="nav-link">
        <span className="nav-icon square" /> Activity
      </NavLink>
      <NavLink to="/activity?view=stats" className="nav-link">
        <span className="nav-icon circle" /> Statistieken
      </NavLink>

      <div className="nav-divider" />

      <NavLink to="/settings" className="nav-link">
        <span className="nav-icon square" /> Settings
      </NavLink>
      <NavLink to="/settings" className="nav-link">
        <span className="nav-icon diamond" /> System
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

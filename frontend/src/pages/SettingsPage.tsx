import { useEffect, useState } from "react";
import { api } from "../api";
import type { Settings, TestResult } from "../types";

const EMPTY: Settings = {
  spotweb_connection_type: "api",
  spotweb_api_url: "",
  spotweb_api_key: "",
  spotweb_db_host: "",
  spotweb_db_port: "3306",
  spotweb_db_name: "",
  spotweb_db_user: "",
  spotweb_db_pass: "",
  download_client_type: "sabnzbd",
  download_client_host: "",
  download_client_port: "",
  download_client_api_key: "",
  download_client_username: "",
  download_client_password: "",
  download_client_category: "watcharr",
};

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotwebTest, setSpotwebTest] = useState<TestResult | null>(null);
  const [clientTest, setClientTest] = useState<TestResult | null>(null);
  const [testingSpotweb, setTestingSpotweb] = useState(false);
  const [testingClient, setTestingClient] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setForm({ ...EMPTY, ...s });
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Laden mislukt"));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateSettings(form);
      setForm({ ...EMPTY, ...updated });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function testSpotweb() {
    setTestingSpotweb(true);
    setSpotwebTest(null);
    try {
      setSpotwebTest(await api.testSpotweb(form));
    } catch (e) {
      setSpotwebTest({
        ok: false,
        message: e instanceof Error ? e.message : "mislukt",
      });
    } finally {
      setTestingSpotweb(false);
    }
  }

  async function testClient() {
    setTestingClient(true);
    setClientTest(null);
    try {
      setClientTest(await api.testDownloadClient(form));
    } catch (e) {
      setClientTest({
        ok: false,
        message: e instanceof Error ? e.message : "mislukt",
      });
    } finally {
      setTestingClient(false);
    }
  }

  if (!loaded && !error)
    return (
      <div className="center-pad">
        <span className="spinner" /> laden…
      </div>
    );

  const sw = form.spotweb_connection_type;
  const dc = form.download_client_type;

  return (
    <div>
      <div className="page-head">
        <div className="page-title">Settings</div>
        <div className="head-actions">
          {saved && <span className="test-result ok">✓ opgeslagen</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="settings-grid">
        {/* ---------- Spotweb ---------- */}
        <div className="settings-col">
          <h2>Spotweb-verbinding</h2>
          <div className="card card-pad">
            <div className="field-label">Verbindingstype</div>
            <div className="toggle-row">
              <div
                className={`toggle${sw === "api" ? " active" : ""}`}
                onClick={() => set("spotweb_connection_type", "api")}
              >
                {sw === "api" ? "◉" : "◯"} Spotweb API
              </div>
              <div
                className={`toggle${sw === "mariadb" ? " active" : ""}`}
                onClick={() => set("spotweb_connection_type", "mariadb")}
              >
                {sw === "mariadb" ? "◉" : "◯"} Direct MariaDB
              </div>
            </div>

            {sw === "api" ? (
              <>
                <div className="field-label">Spotweb URL</div>
                <input
                  className="field mono"
                  value={form.spotweb_api_url}
                  onChange={(e) => set("spotweb_api_url", e.target.value)}
                  placeholder="http://192.168.1.20/spotweb"
                />
                <div className="field-label">API-key</div>
                <input
                  className="field"
                  type="password"
                  value={form.spotweb_api_key}
                  onChange={(e) => set("spotweb_api_key", e.target.value)}
                  placeholder="••••••••"
                />
              </>
            ) : (
              <>
                <div className="field-row">
                  <div>
                    <div className="field-label">Host</div>
                    <input
                      className="field mono"
                      value={form.spotweb_db_host}
                      onChange={(e) => set("spotweb_db_host", e.target.value)}
                      placeholder="192.168.1.20"
                    />
                  </div>
                  <div style={{ maxWidth: 110 }}>
                    <div className="field-label">Poort</div>
                    <input
                      className="field mono"
                      value={form.spotweb_db_port}
                      onChange={(e) => set("spotweb_db_port", e.target.value)}
                      placeholder="3306"
                    />
                  </div>
                </div>
                <div className="field-label">Database</div>
                <input
                  className="field"
                  value={form.spotweb_db_name}
                  onChange={(e) => set("spotweb_db_name", e.target.value)}
                  placeholder="spotweb"
                />
                <div className="field-row">
                  <div>
                    <div className="field-label">Gebruiker</div>
                    <input
                      className="field"
                      value={form.spotweb_db_user}
                      onChange={(e) => set("spotweb_db_user", e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="field-label">Wachtwoord</div>
                    <input
                      className="field"
                      type="password"
                      value={form.spotweb_db_pass}
                      onChange={(e) => set("spotweb_db_pass", e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="hint-box">
                  Een read-only gebruiker volstaat — Watcharr leest alleen de
                  spots-tabel.
                </div>
              </>
            )}

            <div className="test-row">
              <button
                className="btn"
                onClick={testSpotweb}
                disabled={testingSpotweb}
              >
                {testingSpotweb ? "Testen…" : "Test verbinding"}
              </button>
              {spotwebTest && (
                <span
                  className={`test-result ${spotwebTest.ok ? "ok" : "bad"}`}
                >
                  {spotwebTest.ok ? "✓ " : "✗ "}
                  {spotwebTest.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Download client ---------- */}
        <div className="settings-col">
          <h2>Download-client</h2>
          <div className="card card-pad">
            <div className="field-label">Type</div>
            <div className="toggle-row">
              <div
                className={`toggle${dc === "sabnzbd" ? " active" : ""}`}
                onClick={() => set("download_client_type", "sabnzbd")}
              >
                {dc === "sabnzbd" ? "◉" : "◯"} SABnzbd
              </div>
              <div
                className={`toggle${dc === "nzbget" ? " active" : ""}`}
                onClick={() => set("download_client_type", "nzbget")}
              >
                {dc === "nzbget" ? "◉" : "◯"} NZBGet
              </div>
            </div>

            <div className="field-row">
              <div style={{ flex: 2 }}>
                <div className="field-label">Host</div>
                <input
                  className="field mono"
                  value={form.download_client_host}
                  onChange={(e) => set("download_client_host", e.target.value)}
                  placeholder="192.168.1.20"
                />
              </div>
              <div style={{ flex: 1, maxWidth: 110 }}>
                <div className="field-label">Poort</div>
                <input
                  className="field mono"
                  value={form.download_client_port}
                  onChange={(e) => set("download_client_port", e.target.value)}
                  placeholder={dc === "sabnzbd" ? "8080" : "6789"}
                />
              </div>
            </div>

            {dc === "sabnzbd" ? (
              <>
                <div className="field-label">API-key</div>
                <input
                  className="field"
                  type="password"
                  value={form.download_client_api_key}
                  onChange={(e) =>
                    set("download_client_api_key", e.target.value)
                  }
                  placeholder="••••••••"
                />
              </>
            ) : (
              <div className="field-row">
                <div>
                  <div className="field-label">Gebruiker</div>
                  <input
                    className="field"
                    value={form.download_client_username}
                    onChange={(e) =>
                      set("download_client_username", e.target.value)
                    }
                    placeholder="nzbget"
                  />
                </div>
                <div>
                  <div className="field-label">Wachtwoord</div>
                  <input
                    className="field"
                    type="password"
                    value={form.download_client_password}
                    onChange={(e) =>
                      set("download_client_password", e.target.value)
                    }
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <div className="field-label">Categorie / map</div>
            <input
              className="field"
              value={form.download_client_category}
              onChange={(e) => set("download_client_category", e.target.value)}
              placeholder="watcharr"
            />

            <div className="test-row">
              <button
                className="btn"
                onClick={testClient}
                disabled={testingClient}
              >
                {testingClient ? "Testen…" : "Test verbinding"}
              </button>
              {clientTest && (
                <span className={`test-result ${clientTest.ok ? "ok" : "bad"}`}>
                  {clientTest.ok ? "✓ " : "✗ "}
                  {clientTest.message}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { RuleField, Watch, WatchRule } from "../types";
import { NEGATIVE_OPERATORS } from "../utils";

interface Props {
  initial?: Watch | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    is_active: boolean;
    rules: WatchRule[];
    interval_minutes: number;
    download_client: string;
  }) => Promise<void>;
}

const FIELD_OPTIONS: { value: RuleField; label: string }[] = [
  { value: "poster", label: "Poster" },
  { value: "title", label: "Titel" },
  { value: "category", label: "Categorie" },
  { value: "size", label: "Grootte" },
  { value: "date", label: "Datum" },
];

const OPERATORS_BY_FIELD: Record<RuleField, { value: string; label: string }[]> = {
  poster: [
    { value: "is", label: "is" },
    { value: "contains", label: "bevat" },
    { value: "not_contains", label: "bevat niet" },
  ],
  title: [
    { value: "contains", label: "bevat" },
    { value: "not_contains", label: "bevat niet" },
    { value: "starts_with", label: "begint met" },
  ],
  category: [
    { value: "in", label: "in" },
    { value: "not_in", label: "niet in" },
  ],
  size: [
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
  ],
  date: [
    { value: "after", label: "na" },
    { value: "before", label: "voor" },
  ],
};

function defaultRule(): WatchRule {
  return { field: "poster", operator: "is", value: "" };
}

/** Split stored interval_minutes into a {n, unit} pair for the UI. */
function decomposeInterval(minutes: number): { n: number; unit: string } {
  if (minutes % 1440 === 0) return { n: minutes / 1440, unit: "dag" };
  if (minutes % 60 === 0) return { n: minutes / 60, unit: "uur" };
  return { n: minutes, unit: "minuut" };
}

const UNIT_MINUTES: Record<string, number> = {
  minuut: 1,
  uur: 60,
  dag: 1440,
};

export default function AddEditWatchModal({ initial, onClose, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rules, setRules] = useState<WatchRule[]>(
    initial?.rules?.length ? initial.rules : [defaultRule()],
  );
  const initialInterval = decomposeInterval(initial?.interval_minutes ?? 60);
  const [intervalN, setIntervalN] = useState(initialInterval.n);
  const [intervalUnit, setIntervalUnit] = useState(initialInterval.unit);
  const [client, setClient] = useState(initial?.download_client ?? "sabnzbd");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRule(index: number, patch: Partial<WatchRule>) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        // When the field changes, reset the operator to that field's first option.
        if (patch.field && patch.field !== r.field) {
          next.operator = OPERATORS_BY_FIELD[patch.field][0].value;
        }
        return next;
      }),
    );
  }

  function addRule() {
    setRules((prev) => [...prev, defaultRule()]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Geef de Watch een naam.");
      return;
    }
    const cleaned = rules.filter((r) => r.value.trim() !== "");
    if (cleaned.length === 0) {
      setError("Voeg minstens één regel met een waarde toe.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        is_active: initial?.is_active ?? true,
        rules: cleaned,
        interval_minutes: Math.max(1, intervalN) * UNIT_MINUTES[intervalUnit],
        download_client: client,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          {initial ? "Watch bewerken" : "Nieuwe Watch"}
        </div>
        <div className="modal-divider" />

        {error && <div className="error-banner">{error}</div>}

        <div className="field-label">Naam</div>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="bv. Solem PDF's"
        />

        <div className="rule-intro">
          Spots moeten voldoen aan <span className="mini-select">ALLE</span> van:
        </div>

        <div className="rule-rows">
          {rules.map((rule, i) => {
            const negative = NEGATIVE_OPERATORS.has(rule.operator);
            return (
              <div className="rule-row" key={i}>
                <select
                  className="rule-field"
                  value={rule.field}
                  onChange={(e) =>
                    updateRule(i, { field: e.target.value as RuleField })
                  }
                >
                  {FIELD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={`rule-op${negative ? " negative" : ""}`}
                  value={rule.operator}
                  onChange={(e) => updateRule(i, { operator: e.target.value })}
                >
                  {OPERATORS_BY_FIELD[rule.field].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  className={`rule-value${negative ? " negative" : ""}`}
                  value={rule.value}
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                  placeholder={
                    rule.field === "size"
                      ? "MB"
                      : rule.field === "category"
                        ? "bv. PDF"
                        : rule.field === "date"
                          ? "JJJJ-MM-DD"
                          : "waarde"
                  }
                />
                <button
                  className="rule-remove"
                  onClick={() => removeRule(i)}
                  title="Regel verwijderen"
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button className="add-rule" onClick={addRule} type="button">
          + regel toevoegen
        </button>

        <div className="schedule-row">
          <span>Elke</span>
          <input
            className="num"
            type="number"
            min={1}
            value={intervalN}
            onChange={(e) => setIntervalN(Number(e.target.value))}
          />
          <select
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value)}
          >
            <option value="minuut">minuten</option>
            <option value="uur">uur</option>
            <option value="dag">dagen</option>
          </select>
          <span>→</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="sabnzbd">SABnzbd</option>
            <option value="nzbget">NZBGet</option>
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose} type="button" disabled={saving}>
            Annuleren
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            type="button"
            disabled={saving}
          >
            {saving ? "Opslaan…" : "Watch opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

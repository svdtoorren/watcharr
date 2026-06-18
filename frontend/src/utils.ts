import type { RuleField, WatchRule } from "./types";

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} ${d === 1 ? "dag" : "dagen"}`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} uur`;
  }
  return `${minutes} min`;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 0) return "zojuist";
  if (seconds < 60) return "zojuist";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
}

export function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const FIELD_LABELS: Record<RuleField, string> = {
  poster: "poster",
  title: "titel",
  category: "cat",
  size: "grootte",
  date: "datum",
};

const OPERATOR_LABELS: Record<string, string> = {
  is: ":",
  contains: ":",
  not_contains: "≠",
  starts_with: "begint met",
  in: ":",
  not_in: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  after: "na",
  before: "voor",
};

export const NEGATIVE_OPERATORS = new Set(["not_contains", "not_in"]);

export function isNegativeRule(rule: WatchRule): boolean {
  return NEGATIVE_OPERATORS.has(rule.operator);
}

/** Compact chip label, e.g. "poster: solem" or "titel ≠ ebook". */
export function ruleChipLabel(rule: WatchRule): string {
  const field = FIELD_LABELS[rule.field] ?? rule.field;
  const op = OPERATOR_LABELS[rule.operator] ?? rule.operator;
  const value = rule.field === "size" ? `${rule.value} MB` : rule.value;
  if (op === ":") return `${field}: ${value}`;
  return `${field} ${op} ${value}`;
}

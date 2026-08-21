export function calculateChange(current: number, previous?: number): number | null {
  if (previous === undefined || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function formatChange(change: number | null): string {
  if (change === null || !Number.isFinite(change)) return "—";
  return `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`;
}

export function formatPeriodLabel(name: string, createdAt: Date | string): string {
  const normalized = name.replace(/^分析\s*/, "").trim();
  if (normalized) return normalized;
  return new Date(createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

export function getAcosColor(status: string): string {
  switch (status) {
    case "优秀": return "text-emerald-400";
    case "正常": return "text-blue-400";
    case "预警": return "text-yellow-400";
    case "高危": return "text-orange-400";
    case "极危": return "text-red-400";
    case "阻断": return "text-red-600";
    default: return "text-muted-foreground";
  }
}

export function getCvrColor(status: string): string {
  switch (status) {
    case "优秀": return "text-emerald-400";
    case "中等": return "text-blue-400";
    case "及格": return "text-sky-400";
    case "预警": return "text-yellow-400";
    case "严重": return "text-orange-400";
    case "特别严重": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

export function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case "P1": return "badge-p1";
    case "P2": return "badge-p2";
    case "P3": return "badge-p3";
    default: return "";
  }
}

export function getReportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    business_report: "Business Report",
    campaign_report: "Campaign Report",
    targeting_report: "Targeting Report",
    search_term_report: "Search Term Report",
    advertised_product_report: "Advertised Product Report",
    unknown: "未识别",
  };
  return labels[type] ?? type;
}

export function getReportTypeColor(type: string): string {
  const colors: Record<string, string> = {
    business_report: "text-emerald-400 bg-emerald-400/10",
    campaign_report: "text-blue-400 bg-blue-400/10",
    targeting_report: "text-purple-400 bg-purple-400/10",
    search_term_report: "text-yellow-400 bg-yellow-400/10",
    advertised_product_report: "text-orange-400 bg-orange-400/10",
    unknown: "text-muted-foreground bg-muted",
  };
  return colors[type] ?? "text-muted-foreground bg-muted";
}

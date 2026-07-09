import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import {
  XCircle, Target, TrendingUp, Copy, Search, AlertTriangle,
  Star, TrendingDown, Eye, BarChart2, Users, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ============================================================
// 类型定义
// ============================================================
interface SearchTermItem {
  searchTerm: string;
  campaignName: string;
  ownerName: string;
  spend: number;
  clicks: number;
  orders: number;
  acos: number | null;
  cvr: number | null;
  reason: string;
  action?: string;
  negateType?: string;
  matchType?: string;
}

interface SearchTermLists {
  negativeKeywords?: SearchTermItem[];
  exactMatchConversions?: SearchTermItem[];
  scaleUpTerms?: SearchTermItem[];
  negateList?: SearchTermItem[];
  toExactList?: SearchTermItem[];
  amplifyList?: SearchTermItem[];
}

type WordCategory = "brand" | "competitor" | "functional" | "longtail" | "generic";

interface SearchTermAggregate {
  searchTerm: string;
  wordCategory: WordCategory;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
  campaignCount: number;
  campaigns: string[];
  matchTypes: string[];
  ownerNames: string[];
  label: "high_value" | "loss" | "invalid" | "potential" | "normal";
  labelReason: string;
}

interface SearchTermAnalysis {
  totalTerms: number;
  uniqueTerms: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  avgAcos: number | null;
  avgCvr: number | null;
  highValueTerms: SearchTermAggregate[];
  lossTerms: SearchTermAggregate[];
  invalidTerms: SearchTermAggregate[];
  potentialTerms: SearchTermAggregate[];
  categoryDistribution: Record<WordCategory, { count: number; spend: number; orders: number }>;
  topTermsBySpend: SearchTermAggregate[];
  ownerTermStats: Array<{
    ownerName: string;
    ownerCode: string;
    termCount: number;
    spend: number;
    orders: number;
    acos: number | null;
    highValueCount: number;
    invalidCount: number;
  }>;
}

interface Props {
  data: SearchTermLists;
  analysis?: SearchTermAnalysis;
  ownerFilter?: string;
  ownerName?: string;
}

// ============================================================
// 工具函数
// ============================================================
const CATEGORY_LABELS: Record<WordCategory, string> = {
  brand: "品牌词",
  competitor: "竞品词",
  functional: "功能词",
  longtail: "长尾词",
  generic: "泛求词",
};

const CATEGORY_COLORS: Record<WordCategory, string> = {
  brand: "#6366f1",
  competitor: "#f43f5e",
  functional: "#10b981",
  longtail: "#f59e0b",
  generic: "#64748b",
};

const LABEL_CONFIG = {
  high_value: { label: "高价值", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", icon: Star },
  loss: { label: "亏损词", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", icon: TrendingDown },
  invalid: { label: "无效词", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", icon: XCircle },
  potential: { label: "潜力词", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", icon: Eye },
  normal: { label: "正常", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/30", icon: BarChart2 },
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("已复制到剪贴板");
  });
}

// ============================================================
// 子组件：搜索词聚合表格
// ============================================================
function AggregateTable({
  terms,
  title,
  emptyText,
  ownerName,
}: {
  terms: SearchTermAggregate[];
  title: string;
  emptyText: string;
  ownerName?: string;
}) {
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = terms.filter((t) => {
    const matchOwner = !ownerName || t.ownerNames.includes(ownerName);
    const matchSearch = !search || t.searchTerm.toLowerCase().includes(search.toLowerCase());
    return matchOwner && matchSearch;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索词过滤..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/30 border border-border/40 rounded-lg focus:outline-none focus:border-primary/50 focus:bg-muted/50 transition-all"
          />
        </div>
        <button
          onClick={() => copyToClipboard(filtered.map((t) => t.searchTerm).join("\n"))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-lg hover:border-border/70 transition-all"
        >
          <Copy className="h-3 w-3" />
          复制全部词
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} 条</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[200px]">搜索词</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">词性</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">曝光</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">点击</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">花费</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">订单</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">ACOS</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">CVR</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Campaign数</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">标签</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((term) => {
              const labelCfg = LABEL_CONFIG[term.label];
              const isExpanded = expandedRow === term.searchTerm;
              return (
                <>
                  <tr
                    key={term.searchTerm}
                    className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : term.searchTerm)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        <span className="font-mono text-foreground/90 truncate max-w-[160px]" title={term.searchTerm}>
                          {term.searchTerm}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: CATEGORY_COLORS[term.wordCategory] + "22", color: CATEGORY_COLORS[term.wordCategory] }}>
                        {CATEGORY_LABELS[term.wordCategory]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(term.totalImpressions)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(term.totalClicks)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(term.totalSpend)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{term.totalOrders}</td>
                    <td className="px-3 py-2.5 text-right">
                      {term.acos !== null ? (
                        <span className={term.acos > 1 ? "text-red-400" : term.acos > 0.7 ? "text-yellow-400" : "text-emerald-400"}>
                          {formatPercent(term.acos)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {term.cvr !== null ? formatPercent(term.cvr) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{term.campaignCount}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${labelCfg.bg} ${labelCfg.color} ${labelCfg.border}`}>
                        {labelCfg.label}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${term.searchTerm}-detail`} className="bg-muted/10 border-b border-border/20">
                      <td colSpan={10} className="px-6 py-3">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-1 font-medium">关联 Campaign</p>
                            <div className="space-y-0.5">
                              {term.campaigns.slice(0, 3).map((c) => (
                                <p key={c} className="text-foreground/80 truncate" title={c}>{c}</p>
                              ))}
                              {term.campaigns.length > 3 && <p className="text-muted-foreground">...还有 {term.campaigns.length - 3} 个</p>}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 font-medium">匹配类型</p>
                            <div className="flex flex-wrap gap-1">
                              {term.matchTypes.map((m) => (
                                <span key={m} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">{m}</span>
                              ))}
                            </div>
                            <p className="text-muted-foreground mt-2 mb-1 font-medium">负责人</p>
                            <p className="text-foreground/80">{term.ownerNames.join("、") || "未识别"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 font-medium">诊断原因</p>
                            <p className="text-foreground/80">{term.labelReason || "正常表现"}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-muted-foreground text-[10px]">CTR</p>
                                <p className="font-medium">{term.ctr !== null ? formatPercent(term.ctr) : "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[10px]">CPC</p>
                                <p className="font-medium">{term.cpc !== null ? formatCurrency(term.cpc) : "—"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 子组件：词性分布图
// ============================================================
function CategoryDistributionChart({
  distribution,
}: {
  distribution: Record<WordCategory, { count: number; spend: number; orders: number }>;
}) {
  const data = (Object.entries(distribution) as [WordCategory, { count: number; spend: number; orders: number }][])
    .filter(([, v]) => v.count > 0)
    .map(([cat, v]) => ({
      name: CATEGORY_LABELS[cat],
      value: v.count,
      spend: v.spend,
      orders: v.orders,
      color: CATEGORY_COLORS[cat],
    }));

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} 词`, name]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
            />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 self-center">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
            <div className="flex gap-4 text-right">
              <span className="text-foreground font-medium w-12">{d.value} 词</span>
              <span className="text-muted-foreground w-16">{formatCurrency(d.spend)}</span>
              <span className="text-muted-foreground w-10">{d.orders} 单</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 子组件：旧版三清单（否词/转精准/放大）
// ============================================================
function LegacyListTab({
  items,
  emptyText,
  ownerName,
  actionLabel,
}: {
  items: SearchTermItem[];
  emptyText: string;
  ownerName?: string;
  actionLabel: string;
}) {
  const filtered = ownerName ? items.filter((i) => i.ownerName === ownerName) : items;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filtered.length} 条建议</span>
        <button
          onClick={() => copyToClipboard(filtered.map((i) => i.searchTerm).join("\n"))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-lg hover:border-border/70 transition-all"
        >
          <Copy className="h-3 w-3" />
          复制全部词
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/20">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">搜索词</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Campaign</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">负责人</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">花费</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">点击</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">订单</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">ACOS</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">原因</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">{actionLabel}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => (
              <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2.5 font-mono text-foreground/90 max-w-[160px] truncate" title={item.searchTerm}>
                  {item.searchTerm}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={item.campaignName}>
                  {item.campaignName}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.ownerName}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(item.spend)}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(item.clicks)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{item.orders}</td>
                <td className="px-3 py-2.5 text-right">
                  {item.acos !== null ? (
                    <span className={item.acos > 1 ? "text-red-400" : item.acos > 0.7 ? "text-yellow-400" : "text-emerald-400"}>
                      {formatPercent(item.acos)}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate" title={item.reason}>{item.reason}</td>
                <td className="px-3 py-2.5 text-primary max-w-[160px] truncate" title={item.action}>{item.action || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function SearchTermTab({ data, analysis, ownerFilter, ownerName }: Props) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "high_value" | "loss" | "invalid" | "potential" | "top_spend" | "negate" | "to_exact" | "amplify" | "owner_stats"
  >("overview");

  // 标准化旧版三清单
  const negateList: SearchTermItem[] = (data?.negateList ?? data?.negativeKeywords ?? []).map((i) => ({
    ...i,
    cvr: i.cvr ?? (i.clicks > 0 ? i.orders / i.clicks : null),
  }));
  const toExactList: SearchTermItem[] = (data?.toExactList ?? data?.exactMatchConversions ?? []).map((i) => ({
    ...i,
    cvr: i.cvr ?? (i.clicks > 0 ? i.orders / i.clicks : null),
  }));
  const amplifyList: SearchTermItem[] = (data?.amplifyList ?? data?.scaleUpTerms ?? []).map((i) => ({
    ...i,
    cvr: i.cvr ?? (i.clicks > 0 ? i.orders / i.clicks : null),
  }));

  const filteredNegate = ownerName ? negateList.filter((i) => i.ownerName === ownerName) : negateList;
  const filteredToExact = ownerName ? toExactList.filter((i) => i.ownerName === ownerName) : toExactList;
  const filteredAmplify = ownerName ? amplifyList.filter((i) => i.ownerName === ownerName) : amplifyList;

  const TABS = [
    { id: "overview" as const, label: "搜索词概览", icon: BarChart2 },
    { id: "high_value" as const, label: `高价值词 ${analysis?.highValueTerms?.length ?? 0}`, icon: Star },
    { id: "loss" as const, label: `亏损词 ${analysis?.lossTerms?.length ?? 0}`, icon: TrendingDown },
    { id: "invalid" as const, label: `无效词 ${analysis?.invalidTerms?.length ?? 0}`, icon: XCircle },
    { id: "potential" as const, label: `潜力词 ${analysis?.potentialTerms?.length ?? 0}`, icon: Eye },
    { id: "top_spend" as const, label: "花费TOP词", icon: BarChart2 },
    { id: "negate" as const, label: `否词建议 ${filteredNegate.length}`, icon: XCircle },
    { id: "to_exact" as const, label: `转精准 ${filteredToExact.length}`, icon: Target },
    { id: "amplify" as const, label: `放大投放 ${filteredAmplify.length}`, icon: TrendingUp },
    { id: "owner_stats" as const, label: "负责人词汇总", icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Tab导航 */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/30 pb-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 搜索词概览 */}
      {activeTab === "overview" && analysis && (
        <div className="space-y-5">
          {/* 核心指标卡片 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "搜索词总条数", value: formatNumber(analysis.totalTerms), sub: `去重 ${formatNumber(analysis.uniqueTerms)} 个` },
              { label: "搜索词总花费", value: formatCurrency(analysis.totalSpend), sub: "来自Search Term报告" },
              { label: "搜索词总订单", value: String(analysis.totalOrders), sub: "来自Search Term报告" },
              { label: "搜索词平均ACOS", value: analysis.avgAcos !== null ? formatPercent(analysis.avgAcos) : "—", sub: analysis.avgCvr !== null ? `CVR ${formatPercent(analysis.avgCvr)}` : "" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-border/30 bg-card/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* 词性分布 */}
          <div className="rounded-xl border border-border/30 bg-card/50 p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              词性分布
            </h3>
            <CategoryDistributionChart distribution={analysis.categoryDistribution} />
          </div>

          {/* 词标签分布 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: "high_value" as const, count: analysis.highValueTerms.length, label: "高价值词", desc: "转化好、ACOS优" },
              { key: "loss" as const, count: analysis.lossTerms.length, label: "亏损词", desc: "花费多、ACOS高" },
              { key: "invalid" as const, count: analysis.invalidTerms.length, label: "无效词", desc: "点击多、无转化" },
              { key: "potential" as const, count: analysis.potentialTerms.length, label: "潜力词", desc: "曝光多、点击少" },
            ].map((item) => {
              const cfg = LABEL_CONFIG[item.key];
              const Icon = cfg.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`rounded-xl border p-4 text-left transition-all hover:scale-[1.01] ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className={`text-sm font-semibold ${cfg.color}`}>{item.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${cfg.color}`}>{item.count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 无analysis数据时的概览占位 */}
      {activeTab === "overview" && !analysis && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">需要上传 Search Term Report 才能显示搜索词深度分析</p>
        </div>
      )}

      {/* 高价值词 */}
      {activeTab === "high_value" && analysis && (
        <AggregateTable
          terms={analysis.highValueTerms}
          title="高价值词"
          emptyText="暂无高价值词（转化≥3单且ACOS<50%）"
          ownerName={ownerName}
        />
      )}

      {/* 亏损词 */}
      {activeTab === "loss" && analysis && (
        <AggregateTable
          terms={analysis.lossTerms}
          title="亏损词"
          emptyText="暂无亏损词（花费>$5且ACOS≥120%）"
          ownerName={ownerName}
        />
      )}

      {/* 无效词 */}
      {activeTab === "invalid" && analysis && (
        <AggregateTable
          terms={analysis.invalidTerms}
          title="无效词"
          emptyText="暂无无效词（点击>20且0单）"
          ownerName={ownerName}
        />
      )}

      {/* 潜力词 */}
      {activeTab === "potential" && analysis && (
        <AggregateTable
          terms={analysis.potentialTerms}
          title="潜力词"
          emptyText="暂无潜力词（曝光≥500且点击<5）"
          ownerName={ownerName}
        />
      )}

      {/* 花费TOP词 */}
      {activeTab === "top_spend" && analysis && (
        <AggregateTable
          terms={analysis.topTermsBySpend}
          title="花费TOP词"
          emptyText="暂无数据"
          ownerName={ownerName}
        />
      )}

      {/* 否词建议 */}
      {activeTab === "negate" && (
        <LegacyListTab
          items={filteredNegate}
          emptyText="暂无否词建议（点击>20且0单）"
          ownerName={undefined}
          actionLabel="否词操作"
        />
      )}

      {/* 转精准 */}
      {activeTab === "to_exact" && (
        <LegacyListTab
          items={filteredToExact}
          emptyText="暂无转精准建议（Broad/Phrase/Auto中高转化词）"
          ownerName={undefined}
          actionLabel="建议操作"
        />
      )}

      {/* 放大投放 */}
      {activeTab === "amplify" && (
        <LegacyListTab
          items={filteredAmplify}
          emptyText="暂无放大投放建议（精准词≥3单且ACOS<50%）"
          ownerName={undefined}
          actionLabel="建议操作"
        />
      )}

      {/* 负责人词汇总 */}
      {activeTab === "owner_stats" && analysis && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border/30">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">负责人</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">搜索词数</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">花费</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">订单</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">高价值词</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">无效词</th>
                </tr>
              </thead>
              <tbody>
                {analysis.ownerTermStats
                  .filter((s) => !ownerName || s.ownerName === ownerName)
                  .map((s) => (
                    <tr key={s.ownerCode} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{s.ownerName}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(s.termCount)}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(s.spend)}</td>
                      <td className="px-3 py-2.5 text-right">{s.orders}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400 font-medium">{s.highValueCount}</td>
                      <td className="px-3 py-2.5 text-right text-red-400 font-medium">{s.invalidCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

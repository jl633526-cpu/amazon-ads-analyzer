import { useState, useMemo } from "react";
import {
  Search, Star, TrendingDown, XCircle, Eye, DollarSign,
  MinusCircle, ArrowRight, ArrowUpRight, Users, ChevronDown,
  ChevronRight, Copy, Check, GitBranch, Layers,
  BarChart2,
} from "lucide-react";
import {
  ScatterChart as ReScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  BarChart,
  Bar,
} from "recharts";

// ============================================================
// 类型定义
// ============================================================
type WordCategory = "brand" | "competitor" | "functional" | "longtail" | "generic";
type TermLabel = "high_value" | "loss" | "invalid" | "potential" | "normal";

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
  label: TermLabel;
  labelReason: string;
}

interface WordRootAggregate {
  root: string;
  termCount: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  topTerms: string[];
  label: TermLabel;
}

interface MatchTypeAnalysis {
  matchType: string;
  termCount: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  ctr: number | null;
  cpc: number | null;
  spendShare: number;
}

interface ScatterPoint {
  searchTerm: string;
  spend: number;
  cvr: number;
  orders: number;
  acos: number | null;
  label: string;
  wordCategory: WordCategory;
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
    ownerName: string; ownerCode: string; termCount: number;
    spend: number; orders: number; acos: number | null;
    highValueCount: number; invalidCount: number;
  }>;
  wordRootAnalysis?: WordRootAggregate[];
  matchTypeAnalysis?: MatchTypeAnalysis[];
  scatterData?: ScatterPoint[];
}

interface SearchTermItem {
  searchTerm: string;
  campaignName: string;
  adGroupName?: string;
  targeting?: string;
  matchType?: string;
  ownerCode?: string;
  ownerName: string;
  clicks?: number;
  spend?: number;
  orders?: number;
  acos?: number;
  reason: string;
}

interface SearchTermLists {
  negateList?: SearchTermItem[];
  toExactList?: SearchTermItem[];
  amplifyList?: SearchTermItem[];
  [key: string]: SearchTermItem[] | undefined;
}

interface Props {
  data: SearchTermLists | null;
  analysis?: SearchTermAnalysis | null;
  ownerFilter?: string;
  ownerName?: string;
}

// ============================================================
// 格式化
// ============================================================
const pct = (v: number | null | undefined) => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const usd = (v: number | null | undefined) => v == null ? "—" : `$${v.toFixed(2)}`;
const num = (v: number | null | undefined) => v == null ? "—" : v.toLocaleString();

// ============================================================
// 配置
// ============================================================
const LABEL_CONFIG: Record<TermLabel, { color: string; bg: string; text: string }> = {
  high_value: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", text: "高价值" },
  loss:       { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         text: "亏损" },
  invalid:    { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",   text: "无效" },
  potential:  { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       text: "潜力" },
  normal:     { color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",     text: "普通" },
};

const CATEGORY_CONFIG: Record<WordCategory, { label: string; color: string }> = {
  brand:      { label: "品牌词", color: "#6366f1" },
  competitor: { label: "竞品词", color: "#f43f5e" },
  functional: { label: "功能词", color: "#0ea5e9" },
  longtail:   { label: "长尾词", color: "#10b981" },
  generic:    { label: "泛求词", color: "#f59e0b" },
};

const SCATTER_COLORS: Record<string, string> = {
  high_value: "#10b981", loss: "#f43f5e", invalid: "#f59e0b", potential: "#6366f1", normal: "#64748b",
};

const MATCH_COLORS: Record<string, string> = {
  // 中文标准化 key（匹配截图颜色）
  "广泛匹配": "#f59e0b",   // 橙色
  "精确匹配": "#0ea5e9",   // 蓝色
  "短语匹配": "#10b981",   // 绿色
  "ASIN匹配":  "#94a3b8",   // 灰色
  "自动匹配": "#a855f7",   // 紫色
  // 英文兼容（旧数据防御）
  BROAD: "#f59e0b", EXACT: "#0ea5e9", PHRASE: "#10b981",
  TARGETING_EXPRESSION: "#94a3b8", TARGETING_EXPRESSION_PREDEFINED: "#94a3b8",
  UNKNOWN: "#64748b", "未知": "#64748b",
};

// ============================================================
// 子组件：可展开词行
// ============================================================
function TermRow({ agg, rank }: { agg: SearchTermAggregate; rank?: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = LABEL_CONFIG[agg.label];

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setOpen(v => !v)}>
        {rank != null && <span className="text-xs text-muted-foreground w-6 text-center font-mono">{rank}</span>}
        <span className={`text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.text}</span>
        <span className="flex-1 text-sm font-medium truncate">{agg.searchTerm}</span>
        <span className="text-xs text-muted-foreground hidden sm:block flex-shrink-0">{CATEGORY_CONFIG[agg.wordCategory]?.label}</span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <span>花费 <strong className="text-foreground">{usd(agg.totalSpend)}</strong></span>
          <span>订单 <strong className="text-foreground">{agg.totalOrders}</strong></span>
          <span>ACOS <strong className={agg.acos && agg.acos > 0.5 ? "text-red-400" : "text-emerald-400"}>{pct(agg.acos)}</strong></span>
          <span className="hidden md:inline">CVR <strong className="text-foreground">{pct(agg.cvr)}</strong></span>
        </div>
        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(agg.searchTerm).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="p-1 rounded hover:bg-muted/40 text-muted-foreground flex-shrink-0">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </div>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border/20 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><div className="text-xs text-muted-foreground mb-1">曝光</div><div className="text-sm font-medium">{num(agg.totalImpressions)}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">点击</div><div className="text-sm font-medium">{num(agg.totalClicks)}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">CTR</div><div className="text-sm font-medium">{pct(agg.ctr)}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">CPC</div><div className="text-sm font-medium">{usd(agg.cpc)}</div></div>
          {agg.labelReason && (
            <div className="col-span-2 sm:col-span-4"><div className="text-xs text-muted-foreground mb-1">诊断原因</div><div className="text-sm text-amber-400">{agg.labelReason}</div></div>
          )}
          {agg.campaigns.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs text-muted-foreground mb-1">关联Campaign（{agg.campaignCount}个）</div>
              <div className="flex flex-wrap gap-1">{agg.campaigns.map((c, i) => <span key={i} className="text-xs bg-muted/40 rounded px-2 py-0.5 truncate max-w-[200px]">{c}</span>)}</div>
            </div>
          )}
          {agg.matchTypes.length > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <div className="text-xs text-muted-foreground mb-1">匹配类型</div>
              <div className="flex gap-1">{agg.matchTypes.map((m, i) => <span key={i} className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">{m}</span>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 子组件：词根行
// ============================================================
function RootRow({ root, rank }: { root: WordRootAggregate; rank: number }) {
  const [open, setOpen] = useState(false);
  const cfg = LABEL_CONFIG[root.label];
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setOpen(v => !v)}>
        <span className="text-xs text-muted-foreground w-6 text-center font-mono">{rank}</span>
        <span className={`text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.text}</span>
        <span className="flex-1 text-sm font-semibold">{root.root}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline flex-shrink-0">{root.termCount} 个搜索词</span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          <span>花费 <strong className="text-foreground">{usd(root.totalSpend)}</strong></span>
          <span>订单 <strong className="text-foreground">{root.totalOrders}</strong></span>
          <span>ACOS <strong className={root.acos && root.acos > 0.5 ? "text-red-400" : "text-emerald-400"}>{pct(root.acos)}</strong></span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </div>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div><div className="text-xs text-muted-foreground mb-1">曝光</div><div className="text-sm font-medium">{num(root.totalImpressions)}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">点击</div><div className="text-sm font-medium">{num(root.totalClicks)}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">CVR</div><div className="text-sm font-medium">{pct(root.cvr)}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">CTR</div><div className="text-sm font-medium">{pct(root.ctr)}</div></div>
          </div>
          <div className="text-xs text-muted-foreground mb-1">花费最高的子词</div>
          <div className="flex flex-wrap gap-1">{root.topTerms.map((t, i) => <span key={i} className="text-xs bg-muted/40 rounded px-2 py-0.5">{t}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 子组件：操作清单行
// ============================================================
function ActionRow({ item }: { item: SearchTermItem }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-border/30 rounded-lg hover:bg-muted/10 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{item.searchTerm}</span>
          <button onClick={() => navigator.clipboard.writeText(item.searchTerm).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="p-0.5 rounded hover:bg-muted/40 text-muted-foreground flex-shrink-0">
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <div className="text-xs text-muted-foreground truncate">{item.campaignName}</div>
      </div>
      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
        {item.clicks != null && <span>点击 {item.clicks}</span>}
        {item.spend != null && <span>{usd(item.spend)}</span>}
        {item.acos != null && <span>ACOS {pct(item.acos)}</span>}
      </div>
      <span className="text-xs text-amber-400 max-w-[140px] text-right leading-tight flex-shrink-0">{item.reason}</span>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function SearchTermTab({ data, analysis, ownerFilter: _ownerFilter, ownerName }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [rootSearch, setRootSearch] = useState("");
  const [scatterCategory, setScatterCategory] = useState<WordCategory | "all">("all");

  const filterByOwner = <T extends { ownerNames?: string[]; ownerName?: string }>(items: T[]): T[] => {
    if (!ownerName || ownerName === "ALL") return items;
    return items.filter(item => item.ownerNames?.includes(ownerName) || item.ownerName === ownerName);
  };

  const normalizedData = useMemo(() => {
    if (!data) return { negateList: [] as SearchTermItem[], toExactList: [] as SearchTermItem[], amplifyList: [] as SearchTermItem[] };
    return {
      negateList: (data.negateList ?? data.negate_list ?? []) as SearchTermItem[],
      toExactList: (data.toExactList ?? data.to_exact_list ?? []) as SearchTermItem[],
      amplifyList: (data.amplifyList ?? data.amplify_list ?? []) as SearchTermItem[],
    };
  }, [data]);

  const negateFiltered = filterByOwner(normalizedData.negateList);
  const toExactFiltered = filterByOwner(normalizedData.toExactList);
  const amplifyFiltered = filterByOwner(normalizedData.amplifyList);

  const scatterFiltered = useMemo(() => {
    if (!analysis?.scatterData) return [];
    return scatterCategory === "all" ? analysis.scatterData : analysis.scatterData.filter(p => p.wordCategory === scatterCategory);
  }, [analysis?.scatterData, scatterCategory]);

  const rootFiltered = useMemo(() => {
    if (!analysis?.wordRootAnalysis) return [];
    if (!rootSearch.trim()) return analysis.wordRootAnalysis;
    const q = rootSearch.toLowerCase();
    return analysis.wordRootAnalysis.filter(r => r.root.includes(q) || r.topTerms.some(t => t.includes(q)));
  }, [analysis?.wordRootAnalysis, rootSearch]);

  const TABS = [
    { id: "overview",  label: "搜索词概览",  icon: Search,       count: analysis?.uniqueTerms },
    { id: "scatter",   label: "二维分析",     icon: BarChart2,    count: scatterFiltered.length },
    { id: "roots",     label: "词根分析",     icon: GitBranch,    count: analysis?.wordRootAnalysis?.length },
    { id: "matchtype", label: "匹配类型",     icon: Layers,       count: analysis?.matchTypeAnalysis?.length },
    { id: "highvalue", label: "高价值词",     icon: Star,         count: analysis?.highValueTerms?.length },
    { id: "loss",      label: "亏损词",       icon: TrendingDown, count: analysis?.lossTerms?.length },
    { id: "invalid",   label: "无效词",       icon: XCircle,      count: analysis?.invalidTerms?.length },
    { id: "potential", label: "潜力词",       icon: Eye,          count: analysis?.potentialTerms?.length },
    { id: "topspend",  label: "花费TOP词",    icon: DollarSign,   count: analysis?.topTermsBySpend?.length },
    { id: "negate",    label: "否词建议",     icon: MinusCircle,  count: negateFiltered.length },
    { id: "toexact",   label: "转精准",       icon: ArrowRight,   count: toExactFiltered.length },
    { id: "amplify",   label: "放大投放",     icon: ArrowUpRight, count: amplifyFiltered.length },
    { id: "owners",    label: "负责人词汇总", icon: Users,        count: analysis?.ownerTermStats?.length },
  ];

  if (!analysis && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">暂无搜索词数据，请上传 Search Term Report 后重新分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 二级 Tab 导航 */}
      <div className="flex gap-0.5 overflow-x-auto pb-1 scrollbar-hide border-b border-border/30">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t transition-colors ${
              activeTab === tab.id ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 搜索词概览 ── */}
      {activeTab === "overview" && analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "搜索词总行数", value: num(analysis.totalTerms) },
              { label: "去重词数", value: num(analysis.uniqueTerms) },
              { label: "总花费", value: usd(analysis.totalSpend) },
              { label: "总订单", value: num(analysis.totalOrders) },
              { label: "总销售额", value: usd(analysis.totalSales) },
              { label: "平均ACOS", value: pct(analysis.avgAcos) },
              { label: "平均CVR", value: pct(analysis.avgCvr) },
              { label: "高价值词数", value: String(analysis.highValueTerms?.length ?? 0) },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-border/30 rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className="text-xl font-bold">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" />词性分布（按花费）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={Object.entries(analysis.categoryDistribution).map(([k, v]) => ({ name: CATEGORY_CONFIG[k as WordCategory]?.label ?? k, value: Math.round(v.spend * 100) / 100, fill: CATEGORY_CONFIG[k as WordCategory]?.color ?? "#64748b" }))} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {Object.entries(analysis.categoryDistribution).map(([k]) => <Cell key={k} fill={CATEGORY_CONFIG[k as WordCategory]?.color ?? "#64748b"} />)}
                  </Pie>
                  <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: number) => [`$${v.toFixed(2)}`, "花费"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary" />词标签分布</h3>
              <div className="space-y-3">
                {(["high_value", "loss", "invalid", "potential"] as TermLabel[]).map((lbl) => {
                  const counts: Record<string, number> = { high_value: analysis.highValueTerms?.length ?? 0, loss: analysis.lossTerms?.length ?? 0, invalid: analysis.invalidTerms?.length ?? 0, potential: analysis.potentialTerms?.length ?? 0 };
                  const total = Math.max(analysis.uniqueTerms || 1, 1);
                  const cfg = LABEL_CONFIG[lbl];
                  return (
                    <div key={lbl} className="flex items-center gap-2">
                      <span className={`text-xs w-14 text-right flex-shrink-0 ${cfg.color}`}>{cfg.text}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (counts[lbl] / total) * 100)}%`, background: lbl === "high_value" ? "#10b981" : lbl === "loss" ? "#f43f5e" : lbl === "invalid" ? "#f59e0b" : "#6366f1" }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right flex-shrink-0">{counts[lbl]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 二维散点分析 ── */}
      {activeTab === "scatter" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">花费 vs 转化率 散点图</h3>
              <p className="text-xs text-muted-foreground mt-0.5">气泡大小 = 订单数，颜色 = 词标签，仅展示点击≥3次的词</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "brand", "competitor", "functional", "longtail", "generic"] as const).map((cat) => (
                <button key={cat} onClick={() => setScatterCategory(cat)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${scatterCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/30"}`}>
                  {cat === "all" ? "全部" : CATEGORY_CONFIG[cat]?.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-4">
            {scatterFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><BarChart2 className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无散点数据（需要点击≥3次的搜索词）</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <ReScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="spend" name="花费" label={{ value: "花费 ($)", position: "insideBottom", offset: -15, fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis dataKey="cvr" name="CVR" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} label={{ value: "CVR", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <ReTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as ScatterPoint;
                      return (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs space-y-1 max-w-[220px]">
                          <div className="font-medium text-white truncate">{d.searchTerm}</div>
                          <div className="text-slate-400">花费: <span className="text-white">{usd(d.spend)}</span></div>
                          <div className="text-slate-400">CVR: <span className="text-white">{pct(d.cvr)}</span></div>
                          <div className="text-slate-400">订单: <span className="text-white">{d.orders}</span></div>
                          <div className="text-slate-400">ACOS: <span className="text-white">{pct(d.acos)}</span></div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterFiltered}
                    shape={(props: unknown) => {
                      const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint };
                      const r = Math.max(4, Math.min(20, Math.sqrt((payload.orders ?? 0) + 1) * 3));
                      return <circle cx={cx} cy={cy} r={r} fill={SCATTER_COLORS[payload.label] ?? "#64748b"} fillOpacity={0.7} stroke={SCATTER_COLORS[payload.label] ?? "#64748b"} strokeWidth={1} />;
                    }}
                  />
                </ReScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(SCATTER_COLORS).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                {LABEL_CONFIG[label as TermLabel]?.text ?? label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 词根分析 ── */}
      {activeTab === "roots" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold">词根聚合分析</h3>
              <p className="text-xs text-muted-foreground mt-0.5">按搜索词前两词提取词根，聚合旗下所有变体的表现（至少2个变体才展示）</p>
            </div>
            <input type="text" placeholder="搜索词根..." value={rootSearch} onChange={e => setRootSearch(e.target.value)}
              className="text-sm bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-primary/50" />
          </div>
          {rootFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><GitBranch className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无词根数据（需要至少2个同词根的搜索词）</p></div>
          ) : (
            <div className="space-y-2">{rootFiltered.map((root, i) => <RootRow key={root.root} root={root} rank={i + 1} />)}</div>
          )}
        </div>
      )}

      {/* ── 匹配类型分析 ── */}
      {activeTab === "matchtype" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">匹配类型维度分析</h3>
            <p className="text-xs text-muted-foreground mt-0.5">对比 Broad / Phrase / Exact 各匹配类型的花费效率</p>
          </div>
          {!analysis?.matchTypeAnalysis?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Layers className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无匹配类型数据</p></div>
          ) : (
            <>
              <div className="bg-card border border-border/30 rounded-xl p-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-3">花费占比</h4>
                <ResponsiveContainer width="100%" height={Math.max(120, analysis.matchTypeAnalysis.length * 40)}>
                  <BarChart data={analysis.matchTypeAnalysis} layout="vertical" margin={{ left: 120, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis type="category" dataKey="matchType" tick={{ fill: "#94a3b8", fontSize: 11 }} width={120} />
                    <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "花费占比"]} />
                    <Bar dataKey="spendShare" radius={[0, 4, 4, 0]}>
                      {analysis.matchTypeAnalysis.map((entry) => <Cell key={entry.matchType} fill={MATCH_COLORS[entry.matchType] ?? "#6366f1"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        {["匹配类型", "词数", "花费", "订单", "ACOS", "CVR", "CTR", "CPC", "花费占比"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.matchTypeAnalysis.map((mt) => (
                        <tr key={mt.matchType} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: `${MATCH_COLORS[mt.matchType] ?? "#6366f1"}20`, color: MATCH_COLORS[mt.matchType] ?? "#6366f1" }}>{mt.matchType}</span></td>
                          <td className="px-4 py-3 text-muted-foreground">{num(mt.termCount)}</td>
                          <td className="px-4 py-3 font-medium">{usd(mt.totalSpend)}</td>
                          <td className="px-4 py-3">{num(mt.totalOrders)}</td>
                          <td className={`px-4 py-3 font-medium ${mt.acos && mt.acos > 0.5 ? "text-red-400" : "text-emerald-400"}`}>{pct(mt.acos)}</td>
                          <td className="px-4 py-3">{pct(mt.cvr)}</td>
                          <td className="px-4 py-3">{pct(mt.ctr)}</td>
                          <td className="px-4 py-3">{usd(mt.cpc)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted/30 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${mt.spendShare * 100}%`, background: MATCH_COLORS[mt.matchType] ?? "#6366f1" }} /></div>
                              <span className="text-xs text-muted-foreground">{pct(mt.spendShare)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 高价值词 ── */}
      {activeTab === "highvalue" && (
        <div className="space-y-2">
          {!analysis?.highValueTerms?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><Star className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无高价值词</p></div>
            : filterByOwner(analysis.highValueTerms).map((a, i) => <TermRow key={a.searchTerm} agg={a} rank={i + 1} />)}
        </div>
      )}

      {/* ── 亏损词 ── */}
      {activeTab === "loss" && (
        <div className="space-y-2">
          {!analysis?.lossTerms?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><TrendingDown className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无亏损词</p></div>
            : filterByOwner(analysis.lossTerms).map((a, i) => <TermRow key={a.searchTerm} agg={a} rank={i + 1} />)}
        </div>
      )}

      {/* ── 无效词 ── */}
      {activeTab === "invalid" && (
        <div className="space-y-2">
          {!analysis?.invalidTerms?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><XCircle className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无无效词</p></div>
            : filterByOwner(analysis.invalidTerms).map((a, i) => <TermRow key={a.searchTerm} agg={a} rank={i + 1} />)}
        </div>
      )}

      {/* ── 潜力词 ── */}
      {activeTab === "potential" && (
        <div className="space-y-2">
          {!analysis?.potentialTerms?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><Eye className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无潜力词</p></div>
            : filterByOwner(analysis.potentialTerms).map((a, i) => <TermRow key={a.searchTerm} agg={a} rank={i + 1} />)}
        </div>
      )}

      {/* ── 花费TOP词 ── */}
      {activeTab === "topspend" && (
        <div className="space-y-2">
          {!analysis?.topTermsBySpend?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><DollarSign className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无数据</p></div>
            : filterByOwner(analysis.topTermsBySpend).map((a, i) => <TermRow key={a.searchTerm} agg={a} rank={i + 1} />)}
        </div>
      )}

      {/* ── 否词建议 ── */}
      {activeTab === "negate" && (
        <div className="space-y-2">
          {negateFiltered.length === 0 ? <div className="flex flex-col items-center py-16 text-muted-foreground"><MinusCircle className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无否词建议</p></div>
            : negateFiltered.map((item, i) => <ActionRow key={i} item={item} />)}
        </div>
      )}

      {/* ── 转精准 ── */}
      {activeTab === "toexact" && (
        <div className="space-y-2">
          {toExactFiltered.length === 0 ? <div className="flex flex-col items-center py-16 text-muted-foreground"><ArrowRight className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无转精准建议</p></div>
            : toExactFiltered.map((item, i) => <ActionRow key={i} item={item} />)}
        </div>
      )}

      {/* ── 放大投放 ── */}
      {activeTab === "amplify" && (
        <div className="space-y-2">
          {amplifyFiltered.length === 0 ? <div className="flex flex-col items-center py-16 text-muted-foreground"><ArrowUpRight className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无放大投放建议</p></div>
            : amplifyFiltered.map((item, i) => <ActionRow key={i} item={item} />)}
        </div>
      )}

      {/* ── 负责人词汇总 ── */}
      {activeTab === "owners" && (
        <div className="space-y-3">
          {!analysis?.ownerTermStats?.length ? <div className="flex flex-col items-center py-16 text-muted-foreground"><Users className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">暂无负责人数据</p></div>
            : (
              <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        {["负责人", "词数", "花费", "订单", "ACOS", "高价值词", "无效词"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.ownerTermStats.map((o) => (
                        <tr key={o.ownerCode} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-medium">{o.ownerName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{num(o.termCount)}</td>
                          <td className="px-4 py-3 font-medium">{usd(o.spend)}</td>
                          <td className="px-4 py-3">{num(o.orders)}</td>
                          <td className={`px-4 py-3 font-medium ${o.acos && o.acos > 0.5 ? "text-red-400" : "text-emerald-400"}`}>{pct(o.acos)}</td>
                          <td className="px-4 py-3 text-emerald-400">{o.highValueCount}</td>
                          <td className="px-4 py-3 text-orange-400">{o.invalidCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

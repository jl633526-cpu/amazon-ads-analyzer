/**
 * Amazon Ads Analyzer 匹配类型分析：以真实 searchTermAnalysis 聚合数据为唯一数据来源，
 * 按广泛、短语、精确、自动与 ASIN 匹配展示投放效率及可执行的搜索词优化机会。
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronRight,
  CircleAlert,
  Crosshair,
  MousePointerClick,
  SearchCheck,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { canonicalMatchType } from "@/lib/matchTypeUtils";
import { getLoginUrl } from "@/const";

type MatchTypeMetrics = {
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
};

type SearchTerm = {
  searchTerm: string;
  totalSpend: number;
  totalOrders: number;
  totalSales: number;
  acos: number | null;
  cvr: number | null;
  matchTypes: string[];
  label: string;
  labelReason: string;
};

type ActionTerm = {
  searchTerm: string;
  campaignName?: string;
  matchType: string;
  totalSpend?: number;
  spend?: number;
  totalOrders?: number;
  orders?: number;
  acos?: number | null;
  reason: string;
  action: string;
};

type SearchTermResult = {
  matchTypeAnalysis?: MatchTypeMetrics[];
  topTermsBySpend?: SearchTerm[];
};

type AnalysisResult = {
  searchTermAnalysis?: SearchTermResult;
  searchTermLists?: {
    toExactList?: ActionTerm[];
    negateList?: ActionTerm[];
    amplifyList?: ActionTerm[];
  };
};

const TYPE_STYLE: Record<string, { label: string; color: string; soft: string }> = {
  精确匹配: { label: "Exact", color: "#16a34a", soft: "#dcfce7" },
  短语匹配: { label: "Phrase", color: "#2563eb", soft: "#dbeafe" },
  广泛匹配: { label: "Broad", color: "#d97706", soft: "#fef3c7" },
  自动匹配: { label: "Auto", color: "#7c3aed", soft: "#ede9fe" },
  ASIN匹配: { label: "ASIN", color: "#db2777", soft: "#fce7f3" },
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value ?? 0);

const percent = (value: number | null | undefined, fallback = "—") =>
  value === null || value === undefined ? fallback : `${(value * 100).toFixed(1)}%`;

const number = (value: number | null | undefined) => new Intl.NumberFormat("zh-CN").format(value ?? 0);

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Target;
  tone?: string;
}) {
  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${tone}`}>{value}</p>
          </div>
          <span className="rounded-xl bg-muted/70 p-2 text-muted-foreground"><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function TypePill({ type }: { type: string }) {
  const style = TYPE_STYLE[type] ?? { label: type, color: "#64748b", soft: "#f1f5f9" };
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: style.color, background: style.soft }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />{style.label}</span>;
}

export default function MatchTypeAnalysis() {
  const { taskId: rawTaskId } = useParams<{ taskId: string }>();
  const taskId = Number(rawTaskId ?? 0);
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedType, setSelectedType] = useState<string>("");
  const { data, isLoading, isError } = trpc.analysis.getResult.useQuery({ taskId }, { enabled: taskId > 0 });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = getLoginUrl();
  }, [authLoading, isAuthenticated]);

  const result = data?.result as AnalysisResult | undefined;
  const matchTypes = useMemo(() => (result?.searchTermAnalysis?.matchTypeAnalysis ?? []).map((item) => ({ ...item, matchType: canonicalMatchType(item.matchType) })).sort((a, b) => b.totalSpend - a.totalSpend), [result]);

  useEffect(() => {
    if (!selectedType && matchTypes[0]) setSelectedType(matchTypes[0].matchType);
    if (selectedType && !matchTypes.some((item) => item.matchType === selectedType)) setSelectedType(matchTypes[0]?.matchType ?? "");
  }, [matchTypes, selectedType]);

  const selected = matchTypes.find((item) => item.matchType === selectedType) ?? matchTypes[0];
  const total = useMemo(() => matchTypes.reduce((sum, item) => ({ spend: sum.spend + item.totalSpend, sales: sum.sales + item.totalSales, orders: sum.orders + item.totalOrders, clicks: sum.clicks + item.totalClicks }), { spend: 0, sales: 0, orders: 0, clicks: 0 }), [matchTypes]);
  const portfolioAcos = total.sales > 0 ? total.spend / total.sales : null;
  const portfolioRoas = total.spend > 0 ? total.sales / total.spend : null;
  const selectedRoas = selected && selected.totalSpend > 0 ? selected.totalSales / selected.totalSpend : null;
  const topTerms = useMemo(() => (result?.searchTermAnalysis?.topTermsBySpend ?? []).filter((term) => term.matchTypes.some((type) => canonicalMatchType(type) === selected?.matchType)).slice(0, 6), [result, selected?.matchType]);
  const actionItems = useMemo(() => {
    const lists = result?.searchTermLists;
    const items = [
      ...(lists?.toExactList ?? []).map((item) => ({ ...item, kind: "转为精确匹配", tone: "green" })),
      ...(lists?.amplifyList ?? []).map((item) => ({ ...item, kind: "放大优质词", tone: "blue" })),
      ...(lists?.negateList ?? []).map((item) => ({ ...item, kind: "添加否定词", tone: "red" })),
    ];
    return items.filter((item) => canonicalMatchType(item.matchType) === selected?.matchType).slice(0, 5);
  }, [result, selected?.matchType]);

  if (!authLoading && !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/analysis/${taskId}`)} className="shrink-0"><ArrowLeft className="mr-1 h-4 w-4" />返回</Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="min-w-0"><p className="truncate text-sm font-semibold">匹配类型分析</p><p className="hidden text-xs text-muted-foreground sm:block">Search term portfolio · Task #{taskId || "—"}</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/analysis/${taskId}?tab=searchterms`)} className="shrink-0"><SearchCheck className="mr-1.5 h-4 w-4" />查看搜索词</Button>
        </div>
      </header>

      <main className="container py-7 sm:py-9">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.15em] text-primary"><span className="h-px w-7 bg-primary" /> Amazon Ads · Match type</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">匹配类型投放诊断</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">比较广泛、短语、精确、自动和 ASIN 匹配的花费效率，从真实搜索词分析结果中定位扩量、收紧与否定机会。</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm"><p className="text-xs text-muted-foreground">已纳入搜索词</p><p className="mt-1 font-semibold text-primary">{number(result?.searchTermAnalysis?.matchTypeAnalysis?.reduce((sum, item) => sum + item.termCount, 0) ?? 0)} 个</p></div>
        </div>

        {(isLoading || authLoading) && <div className="flex min-h-[340px] items-center justify-center"><div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">正在读取匹配类型聚合数据…</div></div>}

        {!isLoading && (isError || data?.status === "failed") && <Card className="border-destructive/30"><CardContent className="flex flex-col items-start gap-3 p-6"><CircleAlert className="h-6 w-6 text-destructive" /><div><h2 className="font-semibold">分析结果暂时不可用</h2><p className="mt-1 text-sm text-muted-foreground">请返回分析结果页检查该任务的处理状态，或在上传新报表后重新分析。</p></div><Button onClick={() => navigate(`/analysis/${taskId}`)}>返回分析结果</Button></CardContent></Card>}

        {!isLoading && !isError && data?.status === "completed" && matchTypes.length === 0 && <Card><CardContent className="flex flex-col items-start gap-3 p-8"><SearchCheck className="h-7 w-7 text-muted-foreground" /><div><h2 className="font-semibold">暂无可分析的匹配类型数据</h2><p className="mt-1 text-sm text-muted-foreground">该分析任务尚未读取到包含“匹配方式”和“用户搜索词”的 Search Term 报表数据。</p></div><Button variant="outline" onClick={() => navigate(`/analysis/${taskId}`)}>返回分析结果</Button></CardContent></Card>}

        {!isLoading && !isError && data?.status === "completed" && matchTypes.length > 0 && selected && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="搜索词广告花费" value={money(total.spend)} note="所有匹配类型的搜索词花费汇总" icon={BadgeDollarSign} />
            <MetricCard label="归因销售额" value={money(total.sales)} note="来自搜索词报表的广告销售额" icon={ShoppingCart} tone="text-emerald-600 dark:text-emerald-400" />
            <MetricCard label="组合 ACOS" value={percent(portfolioAcos)} note="广告花费 ÷ 广告销售额" icon={TrendingDown} tone={portfolioAcos !== null && portfolioAcos <= 0.3 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} />
            <MetricCard label="组合 ROAS" value={portfolioRoas === null ? "—" : `${portfolioRoas.toFixed(2)}x`} note="广告销售额 ÷ 广告花费" icon={TrendingUp} tone="text-primary" />
          </section>

          <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(310px,.72fr)]">
            <Card className="overflow-hidden border-border/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4"><div><p className="text-xs font-medium uppercase tracking-[.13em] text-muted-foreground">Portfolio allocation</p><CardTitle className="mt-1.5 text-lg">各匹配类型花费占比</CardTitle></div><span className="text-xs text-muted-foreground">按搜索词花费排序</span></CardHeader>
              <CardContent className="h-[320px] px-2 pb-4 pt-5 sm:px-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={matchTypes} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 30 }} barSize={18}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 4" /><XAxis type="number" tickFormatter={(value) => `$${Number(value).toLocaleString()}`} tickLine={false} axisLine={false} fontSize={11} /><YAxis type="category" dataKey="matchType" width={72} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => TYPE_STYLE[value]?.label ?? value} /><Tooltip cursor={{ fill: "hsl(var(--muted) / .5)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} formatter={(value: number) => [money(value), "花费"]} labelFormatter={(value) => TYPE_STYLE[value]?.label ?? value} /><Bar dataKey="totalSpend" radius={[0, 5, 5, 0]}>{matchTypes.map((entry) => <Cell key={entry.matchType} fill={TYPE_STYLE[entry.matchType]?.color ?? "#64748b"} fillOpacity={entry.matchType === selected.matchType ? 1 : 0.58} />)}</Bar></BarChart></ResponsiveContainer></CardContent>
              <div className="grid divide-x divide-border/60 border-t border-border/60 sm:grid-cols-3"><div className="p-4"><p className="text-xs text-muted-foreground">类型数量</p><p className="mt-1 text-xl font-semibold">{matchTypes.length}</p></div><div className="p-4"><p className="text-xs text-muted-foreground">广告订单</p><p className="mt-1 text-xl font-semibold">{number(total.orders)}</p></div><div className="p-4"><p className="text-xs text-muted-foreground">广告点击</p><p className="mt-1 text-xl font-semibold">{number(total.clicks)}</p></div></div>
            </Card>

            <Card className="border-border/70 bg-[linear-gradient(145deg,hsl(var(--card))_0%,hsl(var(--primary)/.07)_100%)]"><CardHeader><p className="text-xs font-medium uppercase tracking-[.13em] text-primary">Selected type</p><CardTitle className="mt-1.5 flex items-center gap-2 text-lg"><TypePill type={selected.matchType} /> <span>{selected.matchType}</span></CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-x-5 gap-y-5"><div><p className="text-xs text-muted-foreground">花费占比</p><p className="mt-1 text-xl font-semibold">{percent(selected.spendShare, "0.0%")}</p></div><div><p className="text-xs text-muted-foreground">关键词 / 搜索词</p><p className="mt-1 text-xl font-semibold">{number(selected.termCount)}</p></div><div><p className="text-xs text-muted-foreground">ACOS</p><p className="mt-1 text-xl font-semibold">{percent(selected.acos)}</p></div><div><p className="text-xs text-muted-foreground">ROAS</p><p className="mt-1 text-xl font-semibold">{selectedRoas === null ? "—" : `${selectedRoas.toFixed(2)}x`}</p></div><div><p className="text-xs text-muted-foreground">CTR</p><p className="mt-1 text-xl font-semibold">{percent(selected.ctr)}</p></div><div><p className="text-xs text-muted-foreground">CVR</p><p className="mt-1 text-xl font-semibold">{percent(selected.cvr)}</p></div></div><div className="mt-6 rounded-xl border border-border/70 bg-background/55 p-3.5 text-xs leading-5 text-muted-foreground"><Crosshair className="mb-2 h-4 w-4 text-primary" />{selected.acos !== null && portfolioAcos !== null ? selected.acos <= portfolioAcos ? "该类型的 ACOS 优于当前搜索词组合平均水平，可优先检查可扩量词。" : "该类型的 ACOS 高于当前搜索词组合平均水平，建议优先复核无效点击和否定词机会。" : "暂缺足够销售额，暂不适合单独判断该类型的投放效率。"}</div></CardContent></Card>
          </section>

          <section className="mt-7"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[.13em] text-muted-foreground">Type comparison</p><h2 className="mt-1 text-xl font-semibold">匹配类型效率对比</h2></div><p className="hidden text-xs text-muted-foreground sm:block">单击任一类型以刷新下方洞察</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{matchTypes.map((item) => { const style = TYPE_STYLE[item.matchType] ?? { label: item.matchType, color: "#64748b", soft: "#f1f5f9" }; const active = item.matchType === selected.matchType; const roas = item.totalSpend > 0 ? item.totalSales / item.totalSpend : null; return <button key={item.matchType} onClick={() => setSelectedType(item.matchType)} className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${active ? "border-primary ring-1 ring-primary/30" : "border-border/70"}`}><div className="flex items-center justify-between gap-2"><TypePill type={item.matchType} /><span className="text-[11px] font-medium text-muted-foreground">{percent(item.spendShare, "0.0%")}</span></div><p className="mt-4 text-2xl font-semibold tracking-tight">{money(item.totalSpend)}</p><p className="mt-1 text-xs text-muted-foreground">{number(item.totalOrders)} 单 · {number(item.termCount)} 词</p><div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3"><div><p className="text-[11px] text-muted-foreground">ACOS</p><p className="font-semibold" style={{ color: style.color }}>{percent(item.acos)}</p></div><div className="text-right"><p className="text-[11px] text-muted-foreground">ROAS</p><p className="font-semibold">{roas === null ? "—" : `${roas.toFixed(2)}x`}</p></div></div></button>; })}</div></section>

          <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(330px,.78fr)]">
            <Card className="border-border/70"><CardHeader className="border-b border-border/60"><p className="text-xs font-medium uppercase tracking-[.13em] text-muted-foreground">Search terms</p><CardTitle className="mt-1.5 flex flex-wrap items-center gap-2 text-lg"><span>{TYPE_STYLE[selected.matchType]?.label ?? selected.matchType} 中花费最高的搜索词</span><TypePill type={selected.matchType} /></CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[670px] text-sm"><thead className="bg-muted/35 text-xs text-muted-foreground"><tr><th className="px-5 py-3 text-left font-medium">搜索词</th><th className="px-4 py-3 text-right font-medium">花费</th><th className="px-4 py-3 text-right font-medium">销售额</th><th className="px-4 py-3 text-right font-medium">订单</th><th className="px-5 py-3 text-right font-medium">ACOS</th></tr></thead><tbody>{topTerms.map((term) => <tr key={term.searchTerm} className="border-t border-border/55 transition-colors hover:bg-muted/25"><td className="px-5 py-4"><p className="font-medium">{term.searchTerm}</p><p className="mt-1 text-xs text-muted-foreground">{term.labelReason || term.label}</p></td><td className="px-4 py-4 text-right">{money(term.totalSpend)}</td><td className="px-4 py-4 text-right">{money(term.totalSales)}</td><td className="px-4 py-4 text-right">{number(term.totalOrders)}</td><td className="px-5 py-4 text-right font-medium">{percent(term.acos)}</td></tr>)}{topTerms.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">该匹配类型下暂无可显示的搜索词聚合数据。</td></tr>}</tbody></table></div></CardContent></Card>

            <Card className="border-border/70"><CardHeader className="border-b border-border/60"><p className="text-xs font-medium uppercase tracking-[.13em] text-muted-foreground">Recommended actions</p><CardTitle className="mt-1.5 text-lg">可执行优化机会</CardTitle></CardHeader><CardContent className="space-y-3 p-4">{actionItems.map((item, index) => <div key={`${item.searchTerm}-${index}`} className="rounded-xl border border-border/70 bg-muted/20 p-3.5"><div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.tone === "red" ? "bg-red-500/10 text-red-600 dark:text-red-400" : item.tone === "green" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>{item.kind}</span><p className="mt-2 font-medium leading-5">{item.searchTerm}</p></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reason || item.action}</p><div className="mt-3 flex items-center justify-between text-xs"><span className="text-muted-foreground">{item.campaignName || "搜索词优化"}</span><span className="font-medium">{money(item.spend ?? item.totalSpend)} · {number(item.orders ?? item.totalOrders)} 单</span></div></div>)}{actionItems.length === 0 && <div className="rounded-xl border border-dashed border-border p-5"><Target className="h-5 w-5 text-muted-foreground" /><p className="mt-3 text-sm font-medium">当前无专项行动</p><p className="mt-1 text-xs leading-5 text-muted-foreground">规则引擎尚未在该匹配类型中识别到转精准、放大或否定词建议。</p></div>}</CardContent></Card>
          </section>
        </>}
      </main>
    </div>
  );
}

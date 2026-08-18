import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Loader2,
  AlertTriangle,
  BarChart3,
  Users,
  Target,
  Search,
  ListChecks,
  UserCircle,
  X,
  ChevronDown,
  Lock,
} from "lucide-react";
import AccountOverviewTab from "@/components/analysis/AccountOverviewTab";
import OwnerAnalysisTab from "@/components/analysis/OwnerAnalysisTab";
import CampaignSuggestionsTab from "@/components/analysis/CampaignSuggestionsTab";
import TargetingSuggestionsTab from "@/components/analysis/TargetingSuggestionsTab";
import SearchTermTab from "@/components/analysis/SearchTermTab";
import ActionItemsTab from "@/components/analysis/ActionItemsTab";

const TABS = [
  { id: "overview", label: "账户总览", icon: BarChart3 },
  { id: "owners", label: "负责人分析", icon: Users },
  { id: "campaigns", label: "Campaign建议", icon: Target },
  { id: "targeting", label: "Targeting建议", icon: Search },
  { id: "searchterms", label: "Search Term清单", icon: Search },
  { id: "actions", label: "运营动作清单", icon: ListChecks },
];

function OwnerSelector({
  owners,
  selected,
  onChange,
}: {
  owners: Array<{ ownerCode: string; ownerName: string }>;
  selected: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOwner = owners.find((o) => o.ownerCode === selected);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all cursor-pointer select-none ${
          selected !== "ALL"
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/50 bg-card text-foreground hover:border-primary/30 hover:bg-muted/30"
        }`}
      >
        <UserCircle className="h-4 w-4 flex-shrink-0" />
        <span className="max-w-[120px] truncate">
          {selected === "ALL" ? "全部负责人" : selectedOwner?.ownerName ?? selected}
        </span>
        {selected !== "ALL" ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("ALL");
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange("ALL");
                setOpen(false);
              }
            }}
            className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden">
            <div className="p-1">
              <button
                onClick={() => { onChange("ALL"); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                  selected === "ALL"
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-xs font-bold text-muted-foreground flex-shrink-0">
                  全
                </div>
                <span>全部负责人</span>
                {selected === "ALL" && <span className="ml-auto text-xs text-primary">✓</span>}
              </button>
              {owners.length > 0 && <div className="my-1 h-px bg-border/50" />}
              {owners.map((owner) => (
                <button
                  key={owner.ownerCode}
                  onClick={() => { onChange(owner.ownerCode); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                    selected === owner.ownerCode
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-foreground hover:bg-muted/30"
                  }`}
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                    style={{
                      background: `hsl(${(owner.ownerCode.charCodeAt(0) * 37) % 360}, 60%, 25%)`,
                      color: `hsl(${(owner.ownerCode.charCodeAt(0) * 37) % 360}, 80%, 70%)`,
                    }}
                  >
                    {owner.ownerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{owner.ownerName}</div>
                    <div className="text-xs text-muted-foreground">{owner.ownerCode}</div>
                  </div>
                  {selected === owner.ownerCode && (
                    <span className="ml-auto text-xs text-primary flex-shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SharedAnalysis() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken ?? "";
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((tab) => tab.id === requestedTab) ? requestedTab! : "overview";
  });
  const [selectedOwner, setSelectedOwner] = useState<string>("ALL");

  const { data, isLoading, error } = trpc.analysis.getSharedResult.useQuery(
    { shareToken },
    {
      enabled: !!shareToken,
      retry: false,
    }
  );

  const isCompleted = data?.status === "completed";
  const result = data?.result;
  const taskName = data?.taskName ?? "分析结果";

  const ownerList = useMemo(() => {
    if (!result?.ownerAnalysis) return [];
    return (result.ownerAnalysis as Array<{ ownerCode: string; ownerName: string }>).map((o) => ({
      ownerCode: o.ownerCode,
      ownerName: o.ownerName,
    }));
  }, [result?.ownerAnalysis]);

  const selectedOwnerName = useMemo(() => {
    if (selectedOwner === "ALL") return "ALL";
    return ownerList.find((o) => o.ownerCode === selectedOwner)?.ownerName ?? "ALL";
  }, [selectedOwner, ownerList]);

  // 链接无效
  if (!isLoading && (error || !shareToken)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center text-center max-w-sm px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-400/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">链接无效</h2>
          <p className="text-muted-foreground text-sm">
            该分享链接不存在或已失效，请联系分析报告的创建者重新分享。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-['Inter',sans-serif]">
      {/* 顶部导航 */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm truncate max-w-[200px]">{taskName}</span>
            </div>
            {/* 只读标识 */}
            <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              只读分享
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCompleted && ownerList.length > 0 && (
              <OwnerSelector
                owners={ownerList}
                selected={selectedOwner}
                onChange={(v) => setSelectedOwner(v)}
              />
            )}
          </div>
        </div>

        {/* Tab 导航 */}
        {isCompleted && (
          <div className="container">
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 筛选状态提示条 */}
        {isCompleted && selectedOwner !== "ALL" && (
          <div className="border-t border-primary/20 bg-primary/5">
            <div className="container flex items-center gap-2 py-2 text-xs text-primary">
              <UserCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                当前仅显示负责人
                <strong className="mx-1">
                  {ownerList.find((o) => o.ownerCode === selectedOwner)?.ownerName ?? selectedOwner}
                </strong>
                的数据与建议
              </span>
              <button
                onClick={() => setSelectedOwner("ALL")}
                className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3" />
                清除筛选
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="container py-8">
        {/* 加载中 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* 分析结果 */}
        {isCompleted && result && (
          <div>
            {activeTab === "overview" && (
              <AccountOverviewTab
                data={result.accountOverview as never}
                files={[]}
                ownerFilter={selectedOwner}
                ownerAnalysis={result.ownerAnalysis as never}
              />
            )}
            {activeTab === "owners" && (
              <OwnerAnalysisTab
                data={result.ownerAnalysis as never}
                ownerFilter={selectedOwner}
              />
            )}
            {activeTab === "campaigns" && (
              <CampaignSuggestionsTab
                data={result.campaignSuggestions as never}
                ownerFilter={selectedOwner}
              />
            )}
            {activeTab === "targeting" && (
              <TargetingSuggestionsTab
                data={result.targetingSuggestions as never}
                ownerFilter={selectedOwner}
                ownerName={selectedOwnerName}
              />
            )}
            {activeTab === "searchterms" && (
              <SearchTermTab
                data={result.searchTermLists as never}
                analysis={result.searchTermAnalysis as never}
                ownerFilter={selectedOwner}
                ownerName={selectedOwnerName}
              />
            )}
            {activeTab === "actions" && (
              <ActionItemsTab
                data={result.actionItems as never}
                onDownload={() => {}}
                ownerFilter={selectedOwner}
                ownerName={selectedOwnerName}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

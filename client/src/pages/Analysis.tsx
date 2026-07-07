import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  TrendingUp,
  ArrowLeft,
  Loader2,
  Download,
  RefreshCw,
  BarChart3,
  Users,
  Target,
  Search,
  ListChecks,
  AlertTriangle,
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

export default function Analysis() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId ?? "0");
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: taskData, isLoading: taskLoading } = trpc.analysis.getTask.useQuery(
    { taskId },
    { enabled: !!taskId }
  );

  const {
    data: resultData,
    isLoading: resultLoading,
    refetch,
  } = trpc.analysis.getResult.useQuery(
    { taskId },
    {
      enabled: !!taskId,
      refetchInterval: (data) => {
        // 如果还在处理中，每3秒刷新
        if (data?.state?.data?.status === "processing" || data?.state?.data?.status === "pending") {
          return 3000;
        }
        return false;
      },
    }
  );

  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const isProcessing =
    resultData?.status === "processing" || resultData?.status === "pending";
  const isFailed = resultData?.status === "failed";
  const isCompleted = resultData?.status === "completed";
  const result = resultData?.result;

  const handleDownloadCSV = () => {
    if (!result?.actionItems) return;
    const items = result.actionItems as Array<Record<string, string>>;
    const headers = ["ID", "优先级", "类别", "负责人", "目标", "问题", "建议动作", "指标"];
    const rows = items.map((item) => [
      item.id,
      item.priority,
      item.category,
      item.ownerName,
      item.target,
      item.issue,
      item.action,
      item.metrics,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `运营动作清单_${taskData?.task?.name ?? taskId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV已下载");
  };

  return (
    <div className="min-h-screen bg-background font-['Inter',sans-serif]">
      {/* 顶部导航 */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm truncate max-w-[200px]">
                {taskData?.task?.name ?? "分析结果"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isProcessing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isProcessing ? "animate-spin" : ""}`} />
              刷新
            </Button>
            {isCompleted && (
              <Button size="sm" onClick={handleDownloadCSV}>
                <Download className="h-4 w-4 mr-1" />
                下载清单
              </Button>
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
      </nav>

      <div className="container py-8">
        {/* 加载中 */}
        {(taskLoading || resultLoading) && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* 处理中 */}
        {!resultLoading && isProcessing && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3">正在分析中...</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              智能体正在处理您的报表数据，识别负责人、计算指标、执行规则诊断，请稍候
            </p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {[
                "✓ 报表类型识别",
                "✓ 字段标准化",
                "⟳ 负责人识别与指标计算",
                "○ 规则引擎诊断",
                "○ 生成优化建议",
              ].map((step, i) => (
                <div key={i} className={i === 2 ? "text-primary" : i > 2 ? "opacity-40" : "text-emerald-400"}>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 失败 */}
        {!resultLoading && isFailed && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-400/10 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">分析失败</h2>
            <p className="text-muted-foreground mb-6">
              {taskData?.task?.errorMessage ?? "处理报表时发生错误，请检查文件格式后重试"}
            </p>
            <Button onClick={() => navigate("/upload")}>重新上传</Button>
          </div>
        )}

        {/* 分析结果 */}
        {isCompleted && result && (
          <div>
            {activeTab === "overview" && (
              <AccountOverviewTab data={result.accountOverview as never} files={taskData?.files ?? []} />
            )}
            {activeTab === "owners" && (
              <OwnerAnalysisTab data={result.ownerAnalysis as never} />
            )}
            {activeTab === "campaigns" && (
              <CampaignSuggestionsTab data={result.campaignSuggestions as never} />
            )}
            {activeTab === "targeting" && (
              <TargetingSuggestionsTab data={result.targetingSuggestions as never} />
            )}
            {activeTab === "searchterms" && (
              <SearchTermTab data={result.searchTermLists as never} />
            )}
            {activeTab === "actions" && (
              <ActionItemsTab data={result.actionItems as never} onDownload={handleDownloadCSV} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

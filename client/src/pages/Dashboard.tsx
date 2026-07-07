import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import {
  TrendingUp,
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronRight,
} from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "等待中", icon: Clock, color: "text-muted-foreground" },
  processing: { label: "分析中", icon: Loader2, color: "text-blue-400", spin: true },
  completed: { label: "已完成", icon: CheckCircle2, color: "text-emerald-400" },
  failed: { label: "失败", icon: XCircle, color: "text-red-400" },
};

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: tasks, isLoading, refetch } = trpc.analysis.listTasks.useQuery(undefined, {
    refetchInterval: 5000, // 每5秒刷新一次
  });

  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background font-['Inter',sans-serif]">
      {/* 顶部导航 */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">历史分析</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button size="sm" onClick={() => navigate("/upload")}>
              <Plus className="h-4 w-4 mr-1" />
              新建分析
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-10 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">历史分析记录</h1>
            <p className="text-muted-foreground text-sm">查看和管理您的广告分析任务</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            刷新
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">暂无分析记录</h3>
            <p className="text-sm text-muted-foreground mb-6">
              上传广告报表开始您的第一次分析
            </p>
            <Button onClick={() => navigate("/upload")}>
              <Plus className="h-4 w-4 mr-1" />
              新建分析
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const statusConf = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = statusConf.icon;
              return (
                <div
                  key={task.id}
                  className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-5 cursor-pointer card-hover"
                  onClick={() => {
                    if (task.status === "completed") {
                      navigate(`/analysis/${task.id}`);
                    }
                  }}
                >
                  <div className={`flex-shrink-0 ${statusConf.color}`}>
                    <StatusIcon
                      className={`h-5 w-5 ${(statusConf as { spin?: boolean }).spin ? "animate-spin" : ""}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">{task.name}</span>
                      <span className={`text-xs ${statusConf.color}`}>{statusConf.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(task.createdAt).toLocaleString("zh-CN")}
                      </span>
                      {task.errorMessage && (
                        <span className="text-red-400 truncate">{task.errorMessage}</span>
                      )}
                    </div>
                  </div>
                  {task.status === "completed" && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

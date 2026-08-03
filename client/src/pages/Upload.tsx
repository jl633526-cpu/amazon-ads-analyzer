import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  X,
} from "lucide-react";
import { getReportTypeLabel, getReportTypeColor } from "@/lib/utils";

interface UploadedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  reportType?: string;
  rowCount?: number;
  fileKey?: string;
  fileUrl?: string;
  error?: string;
}

const REPORT_SLOTS = [
  {
    type: "business_report",
    label: "产品表现报告",
    sublabel: "Business Report",
    desc: "领星：产品表现 | 亚马逊：Business Report",
    color: "border-emerald-400/30 bg-emerald-400/5",
    iconColor: "text-emerald-400",
    required: false,
  },
  {
    type: "campaign_report",
    label: "广告活动报告",
    sublabel: "Campaign Report",
    desc: "领星：广告活动报告 | 亚马逊：Campaign Report",
    color: "border-blue-400/30 bg-blue-400/5",
    iconColor: "text-blue-400",
    required: true,
  },
  {
    type: "targeting_report",
    label: "商品投放报告",
    sublabel: "Targeting Report",
    desc: "领星：投放/商品投放报告 | 亚马逊：Targeting Report",
    color: "border-purple-400/30 bg-purple-400/5",
    iconColor: "text-purple-400",
    required: false,
  },
  {
    type: "search_term_report",
    label: "用户搜索词报告",
    sublabel: "Search Term Report",
    desc: "领星：用户搜索词报告 | 亚马逊：Search Term Report",
    color: "border-yellow-400/30 bg-yellow-400/5",
    iconColor: "text-yellow-400",
    required: false,
  },
  {
    type: "advertised_product_report",
    label: "推广商品报告",
    sublabel: "Advertised Product Report",
    desc: "领星：广告（推广的商品）报告 | 亚马逊：Advertised Product",
    color: "border-orange-400/30 bg-orange-400/5",
    iconColor: "text-orange-400",
    required: false,
  },
];

export default function Upload() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [taskName, setTaskName] = useState(`分析 ${new Date().toLocaleDateString("zh-CN")}`);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = trpc.analysis.createTask.useMutation();
  const saveFileInfo = trpc.analysis.saveFileInfo.useMutation();
  const runAnalysis = trpc.analysis.runAnalysis.useMutation();

  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const uploadFile = async (file: File, fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "uploading", progress: 10 } : f))
    );

    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 80) + 10;
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress: pct } : f))
          );
        }
      };

      const result = await new Promise<{
        success: boolean;
        fileKey: string;
        fileUrl: string;
        reportType: string;
        rowCount: number;
        originalName: string;
      }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || "上传失败"));
          }
        };
        xhr.onerror = () => reject(new Error("网络错误"));
        xhr.open("POST", "/api/upload/report");
        xhr.send(formData);
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "done",
                progress: 100,
                reportType: result.reportType,
                rowCount: result.rowCount,
                fileKey: result.fileKey,
                fileUrl: result.fileUrl,
              }
            : f
        )
      );
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: "error", progress: 0, error: String(err) }
            : f
        )
      );
    }
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles = fileArray.filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop();
      return ["csv", "xlsx", "xls"].includes(ext ?? "");
    });

    if (validFiles.length === 0) {
      toast.error("只支持 CSV、XLSX、XLS 格式");
      return;
    }

    const newUploadFiles: UploadedFile[] = validFiles.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newUploadFiles]);

    // 自动开始上传
    newUploadFiles.forEach((uf) => {
      uploadFile(uf.file, uf.id);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    const doneFiles = files.filter((f) => f.status === "done");
    if (doneFiles.length === 0) {
      toast.error("请先上传至少一个报表文件");
      return;
    }

    setIsSubmitting(true);
    try {
      // 创建任务
      const { taskId } = await createTask.mutateAsync({ name: taskName });

      // 保存文件信息
      for (const f of doneFiles) {
        await saveFileInfo.mutateAsync({
          taskId,
          originalName: f.file.name,
          fileKey: f.fileKey!,
          fileUrl: f.fileUrl!,
          reportType: (f.reportType as "business_report" | "campaign_report" | "targeting_report" | "search_term_report" | "advertised_product_report" | "unknown") ?? "unknown",
          rowCount: f.rowCount ?? 0,
        });
      }

      // 触发分析
      await runAnalysis.mutateAsync({ taskId });

      toast.success("分析已开始，正在处理中...");
      navigate(`/analysis/${taskId}`);
    } catch (err) {
      toast.error(`提交失败: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;

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
              <span className="font-medium text-sm">上传报表</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{user?.name}</span>
          </div>
        </div>
      </nav>

      <div className="container py-10 max-w-4xl">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">上传广告报表</h1>
          <p className="text-muted-foreground">
            支持领星ERP导出格式及亚马逊后台原始报表（5种报表），系统自动识别格式并进行分析
          </p>
        </div>

        {/* 任务名称 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            分析任务名称
          </label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="输入任务名称..."
          />
        </div>

        {/* 支持的报表类型说明 */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_SLOTS.map((slot) => (
            <div
              key={slot.type}
              className={`rounded-lg border p-3 ${slot.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className={`h-4 w-4 ${slot.iconColor}`} />
                <span className="text-xs font-semibold text-foreground">
                  {slot.label}
                  {slot.required && <span className="ml-1 text-red-400">*</span>}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{slot.desc}</p>
            </div>
          ))}
        </div>

        {/* 拖拽上传区域 */}
        <div
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 mb-6 ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border/50 bg-card/30 hover:border-primary/50 hover:bg-card/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="flex flex-col items-center justify-center py-12 px-6 cursor-pointer">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-colors ${
              isDragging ? "bg-primary/30" : "bg-primary/10"
            }`}>
              <UploadIcon className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-primary/70"}`} />
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              {isDragging ? "松开鼠标上传文件" : "拖拽文件到此处，或点击选择"}
            </p>
            <p className="text-sm text-muted-foreground">
              支持 CSV、XLSX、XLS 格式，最大 50MB
            </p>
          </div>
        </div>

        {/* 已上传文件列表 */}
        {files.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              已上传文件 ({doneCount}/{files.length})
              {uploadingCount > 0 && (
                <span className="ml-2 text-muted-foreground">
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1" />
                  {uploadingCount} 个上传中...
                </span>
              )}
            </h3>
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-4"
              >
                {/* 状态图标 */}
                <div className="flex-shrink-0">
                  {f.status === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {f.status === "error" && <XCircle className="h-5 w-5 text-red-400" />}
                  {f.status === "uploading" && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                  {f.status === "pending" && <FileText className="h-5 w-5 text-muted-foreground" />}
                </div>

                {/* 文件信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {f.file.name}
                    </span>
                    {f.reportType && f.reportType !== "unknown" && (
                      <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${getReportTypeColor(f.reportType)}`}>
                        {getReportTypeLabel(f.reportType)}
                      </span>
                    )}
                    {f.reportType === "unknown" && (
                      <span className="flex-shrink-0 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-yellow-400 bg-yellow-400/10">
                        <AlertCircle className="h-3 w-3" />
                        未识别
                      </span>
                    )}
                  </div>
                  {f.status === "uploading" && (
                    <Progress value={f.progress} className="h-1.5" />
                  )}
                  {f.status === "done" && f.rowCount !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {f.rowCount.toLocaleString()} 行数据
                    </p>
                  )}
                  {f.status === "error" && (
                    <p className="text-xs text-red-400">{f.error}</p>
                  )}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {doneCount > 0 ? (
              <span className="text-emerald-400">
                ✓ {doneCount} 个文件已就绪
              </span>
            ) : (
              "请上传至少一个报表文件"
            )}
          </div>
          <Button
            size="lg"
            disabled={doneCount === 0 || isSubmitting || uploadingCount > 0}
            onClick={handleSubmit}
            className="px-8"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交分析中...
              </>
            ) : (
              <>
                开始智能分析
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

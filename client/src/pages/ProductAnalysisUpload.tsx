import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarRange, CheckCircle2, FileSpreadsheet, Loader2, Upload as UploadIcon } from "lucide-react";

type PeriodRole = "current" | "prior";
type UploadState = {
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;
  fileKey?: string;
  fileUrl?: string;
  rowCount?: number;
  error?: string;
};

const PERIOD_COPY: Record<PeriodRole, { title: string; hint: string; color: string }> = {
  current: { title: "本期产品表现报告", hint: "必传：用于生成当前产品业绩、广告与利润分析", color: "border-cyan-400/30 bg-cyan-400/5" },
  prior: { title: "上期产品表现报告", hint: "选传：上传后自动计算销量、销售额、广告费与利润环比", color: "border-violet-400/30 bg-violet-400/5" },
};

export default function ProductAnalysisUpload() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [taskName, setTaskName] = useState(`产品表现分析 ${new Date().toLocaleDateString("zh-CN")}`);
  const [uploads, setUploads] = useState<Partial<Record<PeriodRole, UploadState>>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputs = { current: useRef<HTMLInputElement>(null), prior: useRef<HTMLInputElement>(null) };
  const createTask = trpc.productAnalysis.createTask.useMutation();
  const saveFileInfo = trpc.productAnalysis.saveFileInfo.useMutation();
  const runAnalysis = trpc.productAnalysis.runAnalysis.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.href = getLoginUrl();
  }, [loading, isAuthenticated]);

  const upload = useCallback(async (periodRole: PeriodRole, file: File) => {
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(extension ?? "")) {
      toast.error("请上传 XLSX、XLS 或 CSV 格式的产品表现报告");
      return;
    }
    setUploads((previous) => ({ ...previous, [periodRole]: { file, status: "uploading", progress: 10 } }));
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await new Promise<{ fileKey: string; fileUrl: string; rowCount: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 80) + 10;
            setUploads((previous) => previous[periodRole] ? { ...previous, [periodRole]: { ...previous[periodRole]!, progress } } : previous);
          }
        };
        xhr.onload = () => xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText || "上传失败"));
        xhr.onerror = () => reject(new Error("网络错误"));
        xhr.open("POST", "/api/upload/report");
        xhr.send(formData);
      });
      setUploads((previous) => ({ ...previous, [periodRole]: { file, status: "done", progress: 100, ...response } }));
      toast.success(`${PERIOD_COPY[periodRole].title}上传完成`);
    } catch (error) {
      setUploads((previous) => ({ ...previous, [periodRole]: { file, status: "error", progress: 0, error: String(error) } }));
      toast.error("上传失败，请重试");
    }
  }, []);

  const submit = async () => {
    const current = uploads.current;
    if (!current || current.status !== "done" || !current.fileKey || !current.fileUrl) {
      toast.error("请先上传本期产品表现报告");
      return;
    }
    setSubmitting(true);
    try {
      const { taskId } = await createTask.mutateAsync({ name: taskName });
      for (const periodRole of ["current", "prior"] as PeriodRole[]) {
        const item = uploads[periodRole];
        if (!item || item.status !== "done" || !item.fileKey || !item.fileUrl) continue;
        await saveFileInfo.mutateAsync({ taskId, periodRole, originalName: item.file.name, fileKey: item.fileKey, fileUrl: item.fileUrl, rowCount: item.rowCount ?? 0 });
      }
      await runAnalysis.mutateAsync({ taskId });
      toast.success("产品表现分析已开始");
      navigate(`/product-analysis/${taskId}`);
    } catch (error) {
      toast.error(`提交失败：${String(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isAuthenticated) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="mr-1 h-4 w-4" />返回</Button>
            <span className="h-4 w-px bg-border" />
            <div><p className="text-sm font-semibold">产品表现分析模型</p><p className="text-xs text-muted-foreground">业绩 · 广告 · 利润 · 人员</p></div>
          </div>
          <span className="text-sm text-muted-foreground">{user?.name}</span>
        </div>
      </nav>

      <main className="container max-w-5xl py-10">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"><CalendarRange className="h-3.5 w-3.5" />独立经营分析工作区</div>
          <h1 className="text-3xl font-bold tracking-tight">上传产品表现报告</h1>
          <p className="mt-2 leading-6 text-muted-foreground">以ASIN为粒度汇总销量、销售额、广告费、广告订单占比、客单价、CPC和结算毛利润。上传上期文件后，将自动输出环比变化与风险榜单。</p>
        </div>

        <div className="mb-6 rounded-2xl border border-border/60 bg-card/50 p-5">
          <label className="mb-2 block text-sm font-medium">分析名称</label>
          <input value={taskName} onChange={(event) => setTaskName(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/70" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {(["current", "prior"] as PeriodRole[]).map((role) => {
            const item = uploads[role];
            const meta = PERIOD_COPY[role];
            return <section key={role} className={`rounded-2xl border p-5 ${meta.color}`}>
              <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-semibold">{meta.title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{meta.hint}</p></div>{role === "current" && <span className="rounded bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary">必传</span>}</div>
              <input ref={inputs[role]} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => event.target.files?.[0] && upload(role, event.target.files[0])} />
              {!item ? <button onClick={() => inputs[role].current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/45 text-center transition hover:border-primary/60 hover:bg-primary/5"><UploadIcon className="mb-3 h-7 w-7 text-primary" /><span className="text-sm font-medium">选择产品表现报告</span><span className="mt-1 text-xs text-muted-foreground">支持 XLSX / XLS / CSV</span></button> :
                <div className="rounded-xl border border-border/60 bg-background/70 p-4"><div className="flex items-center gap-3"><FileSpreadsheet className="h-8 w-8 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.file.name}</p><p className="text-xs text-muted-foreground">{item.status === "done" ? `${item.rowCount ?? 0} 条产品记录` : item.status === "error" ? "上传失败" : "上传中"}</p></div>{item.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Loader2 className="h-5 w-5 animate-spin text-primary" />}</div><Progress value={item.progress} className="mt-4 h-1.5" /><button onClick={() => inputs[role].current?.click()} className="mt-4 text-xs text-primary hover:underline">替换文件</button></div>}
            </section>;
          })}
        </div>

        <div className="mt-7 flex justify-end"><Button size="lg" onClick={submit} disabled={submitting || uploads.current?.status !== "done"} className="min-w-44">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>开始产品分析<ArrowRight className="ml-2 h-4 w-4" /></>}</Button></div>
      </main>
    </div>
  );
}

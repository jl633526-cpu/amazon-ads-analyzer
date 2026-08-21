import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createAnalysisTask,
  updateTaskStatus,
  getTaskById,
  getTasksByUserId,
  createReportFile,
  getReportFilesByTaskId,
  saveAnalysisResult,
  getAnalysisResultByTaskId,
  setTaskShareToken,
  getTaskByShareToken,
} from "./db";
import { randomBytes } from "crypto";
import { parseReportBuffer } from "./reportParser";
import { runFullAnalysis } from "./analysisEngine";
import type { StandardRow } from "./reportParser";
import { storageGetSignedUrl } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================
  // 分析任务路由
  // ============================================================
  analysis: router({
    // 获取用户的所有任务列表
    listTasks: protectedProcedure.query(async ({ ctx }) => {
      const tasks = await getTasksByUserId(ctx.user.id);
      return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),

    // 周度总看板：仅返回同时具备业务报告与Campaign报告的已完成任务。
    weeklyOverview: protectedProcedure.query(async ({ ctx }) => {
      const tasks = (await getTasksByUserId(ctx.user.id))
        .filter((task) => task.status === "completed")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const entries = await Promise.all(tasks.map(async (task) => {
        const [files, result] = await Promise.all([
          getReportFilesByTaskId(task.id),
          getAnalysisResultByTaskId(task.id),
        ]);
        const types = new Set(files.map((file) => file.reportType));
        const businessFile = files.find((file) => file.reportType === "business_report");
        const overview = result?.accountOverview as { totalSales?: number } | null;
        const periodMatch = businessFile?.originalName.match(/BusinessReport-(\d{1,2})-(\d{1,2})-(\d{2})/i);
        const taskDateMatch = task.name.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        // 仅纳入文件名能够确认报告周期的周报，避免历史产品表现样本混入周度趋势。
        if (!types.has("business_report") || !types.has("campaign_report") || !overview || !(overview.totalSales ?? 0) || !periodMatch) return null;
        const [, month, day, year] = periodMatch;
        const periodLabel = taskDateMatch
          ? `${taskDateMatch[1]}/${Number(taskDateMatch[2])}/${Number(taskDateMatch[3])}`
          : `20${year}/${Number(month)}/${Number(day)}`;
        return {
          taskId: task.id,
          name: task.name,
          createdAt: task.createdAt,
          periodLabel,
          accountOverview: result!.accountOverview,
        };
      }));

      // 同名任务只保留最近创建的一份，避免重复分析污染周度趋势。
      const latestByPeriod = new Map<string, NonNullable<(typeof entries)[number]>>();
      for (const entry of entries.filter((item): item is NonNullable<typeof item> => item !== null)) {
        latestByPeriod.set(entry.periodLabel, entry);
      }
      return Array.from(latestByPeriod.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }),

    // 获取单个任务详情
    getTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        const files = await getReportFilesByTaskId(input.taskId);
        return { task, files };
      }),

    // 获取分析结果
    getResult: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        if (task.status !== "completed") {
          return { status: task.status, result: null };
        }
        const result = await getAnalysisResultByTaskId(input.taskId);
        return { status: task.status, result };
      }),

    // 创建新任务
    createTask: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const taskId = await createAnalysisTask(ctx.user.id, input.name);
        return { taskId };
      }),

    // 保存已上传文件信息（文件通过REST API上传后调用此接口）
    saveFileInfo: protectedProcedure
      .input(
        z.object({
          taskId: z.number(),
          originalName: z.string(),
          fileKey: z.string(),
          fileUrl: z.string(),
          reportType: z.enum([
            "business_report",
            "campaign_report",
            "targeting_report",
            "search_term_report",
            "advertised_product_report",
            "unknown",
          ]),
          rowCount: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        await createReportFile(input);
        return { success: true };
      }),

    // 生成分享链接（需要登录，仅任务拥有者可生成）
    generateShareLink: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        if (task.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "分析尚未完成，无法分享" });
        }
        // 若已有 token 则复用，否则生成新的
        const token = task.shareToken ?? randomBytes(24).toString("hex");
        if (!task.shareToken) {
          await setTaskShareToken(input.taskId, token);
        }
        return { shareToken: token };
      }),

    // 通过分享 token 获取结果（无需登录）
    getSharedResult: publicProcedure
      .input(z.object({ shareToken: z.string() }))
      .query(async ({ input }) => {
        const task = await getTaskByShareToken(input.shareToken);
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND", message: "分享链接无效或已过期" });
        }
        if (task.status !== "completed") {
          return { status: task.status, result: null, taskName: task.name };
        }
        const result = await getAnalysisResultByTaskId(task.id);
        return { status: task.status, result, taskName: task.name };
      }),

    // 触发分析（服务端执行完整分析流程）
    runAnalysis: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        }
        if (task.status === "processing") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "任务正在处理中" });
        }

        // 异步执行分析
        runAnalysisAsync(input.taskId).catch(console.error);
        return { success: true, message: "分析已开始" };
      }),
  }),

});

export type AppRouter = typeof appRouter;

// ============================================================
// 异步分析执行器
// ============================================================
async function runAnalysisAsync(taskId: number) {
  try {
    await updateTaskStatus(taskId, "processing");

    const files = await getReportFilesByTaskId(taskId);
    if (files.length === 0) {
      await updateTaskStatus(taskId, "failed", "未找到上传的报表文件");
      return;
    }

    // 按类型分组收集行数据
    const allRows: {
      campaignRows: StandardRow[];
      targetingRows: StandardRow[];
      searchTermRows: StandardRow[];
      advertisedProductRows: StandardRow[];
      brRows: StandardRow[];
    } = {
      campaignRows: [],
      targetingRows: [],
      searchTermRows: [],
      advertisedProductRows: [],
      brRows: [],
    };

    // 从存储中读取并解析每个文件
    for (const file of files) {
      try {
        // 使用 storageGetSignedUrl 获取 S3 预签名 URL，再直接下载文件
        const signedUrl = await storageGetSignedUrl(file.fileKey);
        console.log(`[Analysis] Fetching ${file.originalName} from signed URL: ${signedUrl.slice(0, 80)}...`);
        const response = await fetch(signedUrl);
        
        if (!response.ok) {
          console.warn(`[Analysis] Failed to fetch file ${file.originalName}: ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const parsed = await parseReportBuffer(buffer, file.originalName);
        console.log(`[Analysis] Parsed ${file.originalName}: detected type=${parsed.reportType}, rows=${parsed.rowCount}`);

        // 使用实时解析到的类型（parsed.reportType）而非存储时的类型（file.reportType）
        // 这样即使之前上传时误识别也能正确分流
        switch (parsed.reportType) {
          case "campaign_report":
            allRows.campaignRows.push(...parsed.rows);
            break;
          case "targeting_report":
            allRows.targetingRows.push(...parsed.rows);
            break;
          case "search_term_report":
            allRows.searchTermRows.push(...parsed.rows);
            break;
          case "advertised_product_report":
            allRows.advertisedProductRows.push(...parsed.rows);
            break;
          case "business_report":
            allRows.brRows.push(...parsed.rows);
            break;
        }
      } catch (err) {
        console.warn(`[Analysis] Error processing file ${file.originalName}:`, err);
      }
    }

    // 执行完整分析
    const result = runFullAnalysis(allRows);

    // 保存结果
    await saveAnalysisResult(taskId, result as unknown as Record<string, unknown>);
    await updateTaskStatus(taskId, "completed");
  } catch (err) {
    console.error("[Analysis] Fatal error:", err);
    await updateTaskStatus(taskId, "failed", String(err));
  }
}

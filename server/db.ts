import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, analysisTasks, reportFiles, analysisResults } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// Analysis Tasks
// ============================================================
export async function createAnalysisTask(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analysisTasks).values({ userId, name, status: "pending" });
  return result[0].insertId as number;
}

export async function updateTaskStatus(
  taskId: number,
  status: "pending" | "processing" | "completed" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(analysisTasks)
    .set({ status, errorMessage: errorMessage ?? null })
    .where(eq(analysisTasks.id, taskId));
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(analysisTasks).where(eq(analysisTasks.id, taskId)).limit(1);
  return result[0];
}

export async function getTasksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analysisTasks).where(eq(analysisTasks.userId, userId));
}

// ============================================================
// Report Files
// ============================================================
export async function createReportFile(data: {
  taskId: number;
  originalName: string;
  fileKey: string;
  fileUrl: string;
  reportType: "business_report" | "campaign_report" | "targeting_report" | "search_term_report" | "advertised_product_report" | "unknown";
  rowCount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reportFiles).values(data);
}

export async function getReportFilesByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportFiles).where(eq(reportFiles.taskId, taskId));
}

// ============================================================
// Analysis Results
// ============================================================
export async function saveAnalysisResult(taskId: number, result: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = {
    taskId,
    accountOverview: result.accountOverview as never,
    ownerAnalysis: result.ownerAnalysis as never,
    campaignSuggestions: result.campaignSuggestions as never,
    targetingSuggestions: result.targetingSuggestions as never,
    searchTermLists: result.searchTermLists as never,
    searchTermAnalysis: result.searchTermAnalysis as never,
    actionItems: result.actionItems as never,
    rawMetrics: result.rawMetrics as never,
  };
  await db.insert(analysisResults).values(values).onDuplicateKeyUpdate({
    set: {
      accountOverview: values.accountOverview,
      ownerAnalysis: values.ownerAnalysis,
      campaignSuggestions: values.campaignSuggestions,
      targetingSuggestions: values.targetingSuggestions,
      searchTermLists: values.searchTermLists,
      searchTermAnalysis: values.searchTermAnalysis,
      actionItems: values.actionItems,
      rawMetrics: values.rawMetrics,
    },
  });
}

export async function getAnalysisResultByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(analysisResults).where(eq(analysisResults.taskId, taskId)).limit(1);
  return result[0];
}

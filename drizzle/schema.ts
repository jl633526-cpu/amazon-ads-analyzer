import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  float,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 分析任务表
export const analysisTasks = mysqlTable("analysis_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnalysisTask = typeof analysisTasks.$inferSelect;

// 上传的报表文件表
export const reportFiles = mysqlTable("report_files", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  reportType: mysqlEnum("reportType", [
    "business_report",
    "campaign_report",
    "targeting_report",
    "search_term_report",
    "advertised_product_report",
    "unknown",
  ])
    .default("unknown")
    .notNull(),
  rowCount: int("rowCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportFile = typeof reportFiles.$inferSelect;

// 分析结果主表
export const analysisResults = mysqlTable("analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull().unique(),
  // 账户总览
  accountOverview: json("accountOverview"),
  // 负责人分析
  ownerAnalysis: json("ownerAnalysis"),
  // Campaign优化建议
  campaignSuggestions: json("campaignSuggestions"),
  // Targeting优化建议
  targetingSuggestions: json("targetingSuggestions"),
  // Search Term清单
  searchTermLists: json("searchTermLists"),
  // Search Term深度分析（以搜索词为核心）
  searchTermAnalysis: json("searchTermAnalysis"),
  // 产品表现分析（产品表现报告 + 推广商品报告）
  productPerformanceAnalysis: json("productPerformanceAnalysis"),
  // 运营动作清单
  actionItems: json("actionItems"),
  // 原始指标数据
  rawMetrics: json("rawMetrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisResult = typeof analysisResults.$inferSelect;

// 独立产品表现分析任务，不与广告分析任务混用
export const productAnalysisTasks = mysqlTable("product_analysis_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productAnalysisFiles = mysqlTable("product_analysis_files", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  periodRole: mysqlEnum("periodRole", ["current", "prior"]).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 512 }).notNull(),
  rowCount: int("rowCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const productAnalysisResults = mysqlTable("product_analysis_results", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull().unique(),
  summary: json("summary"),
  ownerSummaries: json("ownerSummaries"),
  products: json("products"),
  stars: json("stars"),
  losses: json("losses"),
  attentions: json("attentions"),
  currentPeriod: varchar("currentPeriod", { length: 16 }),
  priorPeriod: varchar("priorPeriod", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

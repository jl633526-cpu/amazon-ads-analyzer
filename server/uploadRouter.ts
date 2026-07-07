/**
 * 文件上传REST API
 * 使用multer处理multipart/form-data文件上传
 */
import { Router } from "express";
import type { Express } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { parseReportBuffer } from "./reportParser";
import { sdk } from "./_core/sdk";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = "." + file.originalname.toLowerCase().split(".").pop();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("只支持 CSV、XLSX、XLS 格式"));
    }
  },
});

export function registerUploadRoutes(app: Express) {
  const router = Router();

  // POST /api/upload/report
  router.post(
    "/api/upload/report",
    async (req, res, next) => {
      // 验证用户身份
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user) {
          res.status(401).json({ error: "未登录" });
          return;
        }
        (req as typeof req & { user: typeof user }).user = user;
        next();
      } catch {
        res.status(401).json({ error: "认证失败" });
      }
    },
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "未收到文件" });
          return;
        }

        const buffer = req.file.buffer;
        const filename = req.file.originalname;

        // 解析报表类型
        const parsed = await parseReportBuffer(buffer, filename);

        // 上传到存储
        const fileKey = `reports/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { key, url } = await storagePut(fileKey, buffer, req.file.mimetype);

        res.json({
          success: true,
          fileKey: key,
          fileUrl: url,
          reportType: parsed.reportType,
          rowCount: parsed.rowCount,
          headers: parsed.headers.slice(0, 20),
          originalName: filename,
        });
      } catch (err) {
        console.error("[Upload] Error:", err);
        res.status(500).json({ error: String(err) });
      }
    }
  );

  app.use(router);
}

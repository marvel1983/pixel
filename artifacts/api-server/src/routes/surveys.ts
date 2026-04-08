import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import {
  submitSurvey, getSurveyByToken, getSurveyStats,
  getRecentSurveys, getSurveySettings, updateSurveySettings,
} from "../services/survey-service";

const router = Router();

router.get("/survey/:token", async (req, res) => {
  const survey = await getSurveyByToken(req.params.token);
  if (!survey) { res.status(404).json({ error: "Survey not found" }); return; }
  res.json({
    orderId: survey.orderId,
    submitted: !!survey.submittedAt,
    rating: survey.rating,
    comment: survey.comment,
  });
});

const submitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

router.post("/survey/:token", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const result = await submitSurvey(req.params.token, parsed.data.rating, parsed.data.comment);
  if ("error" in result) { res.status(400).json(result); return; }
  res.json(result);
});

const adminMiddleware = [requireAuth, requireAdmin, requirePermission("manageContent")];

router.get("/admin/surveys/stats", ...adminMiddleware, async (_req, res) => {
  const stats = await getSurveyStats();
  res.json(stats);
});

router.get("/admin/surveys/responses", ...adminMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
  const responses = await getRecentSurveys(limit);
  res.json({ responses });
});

router.get("/admin/surveys/settings", ...adminMiddleware, async (_req, res) => {
  const settings = await getSurveySettings();
  res.json(settings ?? { enabled: true, delayDays: 3, emailSubject: "How was your experience?" });
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  delayDays: z.number().int().min(1).max(30).optional(),
  emailSubject: z.string().min(1).max(200).optional(),
  emailBody: z.string().max(5000).optional(),
});

router.put("/admin/surveys/settings", ...adminMiddleware, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  await updateSurveySettings(parsed.data);
  res.json({ success: true });
});

export default router;

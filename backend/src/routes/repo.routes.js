import express from "express";
import {
  analyzeRepo,
  chatAboutRepo,
  reindexRepo,
  checkRepoStatus,
  getQuotaLimits,
} from "../controllers/repo.controller.js";
import { validateRepoUrl, validateChatInput } from "../middlewares/validate.middleware.js";

const router = express.Router();

// GET /api/repo/limits — Get remaining quota limits for client IP
router.get("/repo/limits", getQuotaLimits);

// POST /api/repo/analyze — Stream indexing progress & AI analysis of a GitHub repo
router.post("/repo/analyze", validateRepoUrl, analyzeRepo);

// POST /api/repo/reindex — Force re-indexing & stream analysis
router.post("/repo/reindex", validateRepoUrl, reindexRepo);

// GET /api/repo/status?url=... — Get index status of a repository
router.get("/repo/status", checkRepoStatus);

// POST /api/repo/chat — Stream RAG AI chat about a GitHub repo
router.post("/repo/chat", validateChatInput, chatAboutRepo);

export default router;
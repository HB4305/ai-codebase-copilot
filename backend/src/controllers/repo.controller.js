/**
 * Repo Controller
 * Handles HTTP requests for repository analysis, indexing, status, and chat.
 * Uses Server-Sent Events (SSE) for streaming responses.
 */

import {
  analyzeRepoStream,
  chatAboutRepoStream,
  reindexRepoStream,
  getRepoStatus,
} from "../services/repo.service.js";
import { getRemainingQuota, checkAndRecordHit } from "../utils/rate-limiter.js";

/**
 * GET /api/repo/limits
 * Returns remaining rate limits for the client IP
 */
export const getQuotaLimits = (req, res) => {
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const limits = getRemainingQuota(clientIp);
  res.json(limits);
};

/**
 * POST /api/repo/analyze
 * Body: { url: string, lang?: string }
 * Streams AI analysis as SSE
 */
export const analyzeRepo = async (req, res, next) => {
  const { url, lang = 'en' } = req.body;
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

  // Record usage
  checkAndRecordHit(clientIp, "analyze");

  // Set SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await analyzeRepoStream(url, res, lang, false);
  } catch (err) {
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
};

/**
 * POST /api/repo/reindex
 * Body: { url: string, lang?: string }
 * Forces re-indexing and streams progress/analysis as SSE
 */
export const reindexRepo = async (req, res, next) => {
  const { url, lang = 'en' } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await reindexRepoStream(url, res, lang);
  } catch (err) {
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
};

/**
 * GET /api/repo/status?url=...
 * Returns index status of a repository
 */
export const checkRepoStatus = async (req, res, next) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing query parameter: url" });
  }

  try {
    const status = await getRepoStatus(url);
    res.json(status);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repo/chat
 * Body: { url: string, message: string, history: Array, lang?: string }
 * Streams RAG AI chat reply as SSE
 */
export const chatAboutRepo = async (req, res, next) => {
  const { url, message, history = [], lang = 'en' } = req.body;
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";

  // Record usage
  checkAndRecordHit(clientIp, "chat");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await chatAboutRepoStream(url, history, message, res, lang);
  } catch (err) {
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
};
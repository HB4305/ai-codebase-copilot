import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import healthRoutes from "./routes/health.routes.js";
import repoRoutes from "./routes/repo.routes.js";
import notFoundMiddleware from "./middlewares/not-found.middleware.js";
import errorMiddleware from "./middlewares/error.middleware.js";

const app = express();

// Parse rate limit configurations with safe fallbacks
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const maxAnalyzeRequests = parseInt(process.env.RATE_LIMIT_MAX_ANALYZE) || 5;
const maxChatRequests = parseInt(process.env.RATE_LIMIT_MAX_CHAT) || 60;

// Rate limiter for repository analysis (stricter limit for resource-heavy operations)
const analyzeLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: maxAnalyzeRequests,
  message: {
    error: "Too many repository analysis requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for repository chat (more relaxed limit for interactive conversation)
const chatLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: maxChatRequests,
  message: {
    error: "Too many chat requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure CORS to support local development, custom domain, Vercel deployments, and environment origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(url => url.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = 
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(origin) || 
      origin === "https://hoaichaobai.online" ||
      origin === "https://www.hoaichaobai.online" ||
      /^https?:\/\/.*\.hoaichaobai\.online$/.test(origin) ||
      /^https?:\/\/.*\.vercel\.app$/.test(origin) ||
      /^https?:\/\/localhost:\d+$/.test(origin) || 
      /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin);
                      
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

// Apply rate limiters to specific endpoints
app.use("/api/repo/analyze", analyzeLimiter);
app.use("/api/repo/chat", chatLimiter);

app.use("/api", healthRoutes);
app.use("/api", repoRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
/**
 * Error Middleware
 * Centralized error handling with proper HTTP status codes.
 */

const errorMiddleware = (err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  if (err.stack) console.error(err.stack);

  // GitHub API errors
  if (err.message?.includes("not found or is private")) {
    return res.status(404).json({ error: err.message });
  }
  if (err.message?.includes("rate limit")) {
    return res.status(429).json({ error: err.message });
  }
  if (err.message?.includes("Invalid GitHub URL")) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes("GitHub API error")) {
    return res.status(502).json({ error: "GitHub API is unavailable. Please try again later." });
  }

  // OpenAI API errors
  if (err.status === 401) {
    return res.status(401).json({ error: "Invalid OpenAI API key. Please check your configuration." });
  }
  if (err.status === 429) {
    return res.status(429).json({ error: "OpenAI rate limit exceeded. Please try again later." });
  }
  if (err.status >= 500 && err.status < 600) {
    return res.status(503).json({ error: "OpenAI service is temporarily unavailable." });
  }

  // Generic fallback
  res.status(500).json({
    error: "Internal server error. Please try again.",
  });
};

export default errorMiddleware;
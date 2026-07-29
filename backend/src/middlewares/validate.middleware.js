/**
 * Validate Middleware
 * Validates incoming request bodies before they hit the controller.
 */

const GITHUB_URL_PATTERN = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/i;

/**
 * Validates that the request body contains a valid GitHub URL
 */
export const validateRepoUrl = (req, res, next) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      error: "Missing required field: url",
    });
  }

  if (!GITHUB_URL_PATTERN.test(url.trim())) {
    return res.status(400).json({
      error: "Invalid GitHub URL. Please provide a valid GitHub repository URL (e.g., https://github.com/owner/repo).",
    });
  }

  next();
};

/**
 * Validates the chat request body
 */
export const validateChatInput = (req, res, next) => {
  const { url, message, history } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing required field: url" });
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Missing required field: message" });
  }

  if (history !== undefined && !Array.isArray(history)) {
    return res.status(400).json({ error: "Field 'history' must be an array" });
  }

  if (!GITHUB_URL_PATTERN.test(url.trim())) {
    return res.status(400).json({
      error: "Invalid GitHub URL.",
    });
  }

  next();
};

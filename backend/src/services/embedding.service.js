/**
 * Embedding Service
 * Converts text chunks and search queries into vector embeddings.
 * Features token-aware batching and exponential backoff retry.
 */

import OpenAI from "openai";

let _openaiClient = null;

const getEmbeddingConfig = () => {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || "";
  const provider = process.env.EMBEDDING_PROVIDER || (apiKey.startsWith("sk-or-v1-") ? "openrouter" : "openai");
  const baseURL = process.env.EMBEDDING_BASE_URL || (
    provider === "openrouter" || apiKey.startsWith("sk-or-v1-")
      ? "https://openrouter.ai/api/v1"
      : undefined
  );
  let model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  if ((provider === "openrouter" || apiKey.startsWith("sk-or-v1-")) && !model.includes("/")) {
    model = `openai/${model}`;
  }

  return {
    provider,
    baseURL,
    model,
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536,
    apiKey,
  };
};

const getClient = () => {
  if (!_openaiClient) {
    const config = getEmbeddingConfig();
    const options = { apiKey: config.apiKey };
    if (config.baseURL) {
      options.baseURL = config.baseURL;
    }
    _openaiClient = new OpenAI(options);
  }
  return _openaiClient;
};

/**
 * Estimate token count (~4 characters per token for code)
 */
export const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

const MAX_BATCH_INPUTS = 50;
const MAX_BATCH_TOKENS = 30000;

/**
 * Create token-aware batches from an array of texts
 */
function createTokenAwareBatches(texts) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);

    if (
      currentBatch.length >= MAX_BATCH_INPUTS ||
      (currentTokens + tokens > MAX_BATCH_TOKENS && currentBatch.length > 0)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(text);
    currentTokens += tokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Embed a single batch with exponential backoff retry
 */
async function embedBatchWithRetry(batch, maxRetries = 5) {
  const config = getEmbeddingConfig();
  const client = getClient();
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await client.embeddings.create({
        model: config.model,
        input: batch,
        dimensions: config.dimensions,
      });

      return response.data.map((item) => item.embedding);
    } catch (err) {
      const status = err.status || err.response?.status;

      // Do NOT retry for 400 Bad Request, 401 Unauthorized, 403 Forbidden
      if (status === 400 || status === 401 || status === 403) {
        throw err;
      }

      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(
          `Embedding API failed after ${maxRetries} attempts: ${err.message}`
        );
      }

      // Check Retry-After header if present
      let delayMs = Math.pow(2, attempt) * 1000;
      if (err.headers?.["retry-after"]) {
        const retryAfterSec = parseInt(err.headers["retry-after"]);
        if (!isNaN(retryAfterSec)) {
          delayMs = Math.max(delayMs, retryAfterSec * 1000);
        }
      }

      console.warn(
        `[Embedding] Attempt ${attempt} failed (${err.message}). Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Embed an array of texts
 * @param {string[]} texts 
 * @returns {Promise<number[][]>} Array of vector embeddings
 */
export const embedTexts = async (texts) => {
  if (!texts || texts.length === 0) return [];
  const batches = createTokenAwareBatches(texts);
  const allEmbeddings = [];

  for (const batch of batches) {
    const embeddings = await embedBatchWithRetry(batch);
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
};

/**
 * Embed a single query string for RAG retrieval
 * @param {string} query 
 * @returns {Promise<number[]>} Vector embedding
 */
export const embedQuery = async (query) => {
  const result = await embedTexts([query]);
  return result[0];
};

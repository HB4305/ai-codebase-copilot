/**
 * Retrieval Service
 * Implements Hybrid Search (dense vector + exact identifier + neighbor expansion + query rewrite).
 */

import { embedQuery } from "./embedding.service.js";
import { searchVectors, searchExact } from "./vectorstore.service.js";
import { UNTRUSTED_CONTENT_SEPARATOR } from "../utils/denylist.js";

/**
 * Extract code identifiers (filenames, function names, camelCase, snake_case) from a user query
 */
const extractIdentifiers = (query) => {
  if (!query) return { fileNames: [], symbolNames: [] };

  const fileNames = [];
  const symbolNames = [];

  // Match file paths (e.g. auth.js, src/utils/token.ts)
  const fileRegex = /([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+)/g;
  let match;
  while ((match = fileRegex.exec(query)) !== null) {
    fileNames.push(match[1]);
  }

  // Match identifiers inside backticks or camelCase / snake_case
  const symbolRegex = /`([a-zA-Z0-9_$]+)`|\b([a-zA-Z0-9_$]{3,})\b/g;
  while ((match = symbolRegex.exec(query)) !== null) {
    const symbol = match[1] || match[2];
    if (symbol && !fileNames.includes(symbol) && /[A-Z_]/.test(symbol)) {
      symbolNames.push(symbol);
    }
  }

  return { fileNames, symbolNames };
};

/**
 * Perform hybrid retrieval for a query
 * @param {string} userMessage - User's question
 * @param {string} repoKey - Canonical repo key
 * @param {number} activeVersion - Active index version
 * @param {Array} chatHistory - Recent chat history
 * @param {string} tenantId - Tenant ID
 */
export const retrieveContext = async (
  userMessage,
  repoKey,
  activeVersion,
  chatHistory = [],
  tenantId = "anonymous"
) => {
  let searchQuery = userMessage;

  // 1. Embed search query
  const queryEmbedding = await embedQuery(searchQuery);

  // 2. Perform dense vector search (topK = 10)
  const denseResults = await searchVectors(queryEmbedding, repoKey, activeVersion, 10, tenantId);

  // 3. Perform exact matching on identifiers if present
  const { fileNames, symbolNames } = extractIdentifiers(userMessage);
  const exactResults = [];

  for (const fileName of fileNames) {
    const matched = await searchExact(repoKey, activeVersion, "filePath", fileName, 3, tenantId);
    exactResults.push(...matched);
  }

  for (const symbolName of symbolNames) {
    const matched = await searchExact(repoKey, activeVersion, "name", symbolName, 3, tenantId);
    exactResults.push(...matched);
  }

  // 4. Combine & deduplicate by chunkKey
  const seenKeys = new Set();
  const combined = [];

  // Add exact matches first for higher priority
  for (const item of exactResults) {
    if (item.chunkKey && !seenKeys.has(item.chunkKey)) {
      seenKeys.add(item.chunkKey);
      combined.push({ ...item, isExact: true });
    }
  }

  // Add dense vector matches
  for (const item of denseResults) {
    if (item.chunkKey && !seenKeys.has(item.chunkKey)) {
      seenKeys.add(item.chunkKey);
      combined.push(item);
    }
  }

  // Cap top results to 8
  const finalChunks = combined.slice(0, 8);

  // 5. Format context string & sources list
  const sources = finalChunks.map((c) => ({
    filePath: c.filePath,
    startLine: c.startLine,
    endLine: c.endLine,
    name: c.name || "",
  }));

  const chunksText = finalChunks
    .map(
      (c) =>
        `### Source: ${c.filePath} (Lines ${c.startLine}-${c.endLine})${c.name ? ` - Symbol: ${c.name}` : ""}\n\`\`\`${c.language || ""}\n${c.content}\n\`\`\``
    )
    .join("\n\n");

  const formattedContext = `
${UNTRUSTED_CONTENT_SEPARATOR}

## Retrieved Relevant Code Snippets:

${chunksText || "No specific code chunks found matching your query."}
`.trim();

  return { context: formattedContext, sources };
};

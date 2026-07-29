/**
 * Chunker Service
 * Splits source code files into semantic chunks (functions, classes, modules, configs).
 * Designed with a LanguageChunker interface for seamless Tree-sitter migration.
 */

import { isDenylisted } from "../utils/denylist.js";
import { estimateTokens } from "./embedding.service.js";

// Supported indexable file extensions
const EXTENSION_MAP = {
  // Code
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
  swift: "swift", kt: "kotlin", kts: "kotlin",
  // Styles
  css: "css", scss: "scss", less: "less",
  // Configs
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  makefile: "makefile", dockerfile: "dockerfile",
  // Docs
  md: "markdown", txt: "text", rst: "rst",
};

/**
 * Check if a file is indexable based on extension and denylist
 */
export const isIndexableFile = (filePath) => {
  if (!filePath || isDenylisted(filePath)) return false;

  const baseName = filePath.split("/").pop() || "";
  const lowerBase = baseName.toLowerCase();

  if (lowerBase === "dockerfile" || lowerBase === "makefile") return true;

  const ext = lowerBase.split(".").pop();
  return Boolean(ext && EXTENSION_MAP[ext]);
};

/**
 * Get language identifier from file path
 */
export const getLanguageFromExtension = (filePath) => {
  const baseName = (filePath || "").split("/").pop() || "";
  const lowerBase = baseName.toLowerCase();

  if (lowerBase === "dockerfile") return "dockerfile";
  if (lowerBase === "makefile") return "makefile";

  const ext = lowerBase.split(".").pop();
  return (ext && EXTENSION_MAP[ext]) || "plaintext";
};

// Regex patterns for function/class detection per language
const LANGUAGE_PATTERNS = {
  javascript: [
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/m,
    /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/m,
  ],
  typescript: [
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?type\s+([a-zA-Z0-9_$]+)/m,
    /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/m,
  ],
  python: [
    /^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/m,
    /^class\s+([a-zA-Z0-9_]+)/m,
  ],
  java: [
    /^\s*(?:public|private|protected|static|\s)*(?:class|interface|enum)\s+([a-zA-Z0-9_]+)/m,
    /^\s*(?:public|private|protected|static|\s)*[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\(/m,
  ],
  go: [
    /^func\s+([a-zA-Z0-9_]+)\s*\(/m,
    /^func\s+\([^)]+\)\s+([a-zA-Z0-9_]+)\s*\(/m,
    /^type\s+([a-zA-Z0-9_]+)\s+struct/m,
  ],
};

const FALLBACK_MAX_TOKENS = 500;
const FALLBACK_OVERLAP_TOKENS = 50;

/**
 * Fallback token-based chunker for large blocks or unsupported languages
 */
function tokenFallbackChunk(lines, filePath, language, startLineOffset = 1) {
  const chunks = [];
  let currentChunkLines = [];
  let currentTokens = 0;
  let chunkStartLine = startLineOffset;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = estimateTokens(line) + 1; // +1 for newline

    if (currentTokens + lineTokens > FALLBACK_MAX_TOKENS && currentChunkLines.length > 0) {
      const content = currentChunkLines.join("\n");
      chunks.push({
        content,
        metadata: {
          filePath,
          language,
          type: "block",
          name: "",
          startLine: chunkStartLine,
          endLine: chunkStartLine + currentChunkLines.length - 1,
        },
      });

      // Overlap: keep last few lines
      const overlapLines = [];
      let overlapTokens = 0;
      for (let j = currentChunkLines.length - 1; j >= 0; j--) {
        const oTokens = estimateTokens(currentChunkLines[j]);
        if (overlapTokens + oTokens > FALLBACK_OVERLAP_TOKENS) break;
        overlapLines.unshift(currentChunkLines[j]);
        overlapTokens += oTokens;
      }

      currentChunkLines = overlapLines;
      currentTokens = overlapTokens;
      chunkStartLine = startLineOffset + i - currentChunkLines.length;
    }

    currentChunkLines.push(line);
    currentTokens += lineTokens;
  }

  if (currentChunkLines.length > 0) {
    const content = currentChunkLines.join("\n");
    chunks.push({
      content,
      metadata: {
        filePath,
        language,
        type: "block",
        name: "",
        startLine: chunkStartLine,
        endLine: chunkStartLine + currentChunkLines.length - 1,
      },
    });
  }

  return chunks;
}

/**
 * Chunk a single file content into semantic parts
 * @param {string} filePath 
 * @param {string} content 
 * @returns {Array<{content: string, metadata: object}>}
 */
export const chunkFile = (filePath, content) => {
  if (!content || typeof content !== "string") return [];
  const language = getLanguageFromExtension(filePath);
  const lines = content.split(/\r?\n/);
  const patterns = LANGUAGE_PATTERNS[language];

  // If file is short (< 60 lines), treat as single chunk
  if (lines.length <= 60) {
    return [
      {
        content,
        metadata: {
          filePath,
          language,
          type: "file",
          name: filePath.split("/").pop() || "",
          startLine: 1,
          endLine: lines.length,
        },
      },
    ];
  }

  // If no specific patterns for language, use token fallback
  if (!patterns) {
    return tokenFallbackChunk(lines, filePath, language, 1);
  }

  // Find symbol boundaries using patterns
  const symbolIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        symbolIndices.push({
          lineIndex: i,
          name: match[1] || "",
          type: pattern.source.includes("class") ? "class" : "function",
        });
        break;
      }
    }
  }

  if (symbolIndices.length === 0) {
    return tokenFallbackChunk(lines, filePath, language, 1);
  }

  const chunks = [];

  // Header chunk if file starts before first symbol
  if (symbolIndices[0].lineIndex > 0) {
    const headerLines = lines.slice(0, symbolIndices[0].lineIndex);
    chunks.push({
      content: headerLines.join("\n"),
      metadata: {
        filePath,
        language,
        type: "header",
        name: "(header)",
        startLine: 1,
        endLine: symbolIndices[0].lineIndex,
      },
    });
  }

  // Symbol chunks
  for (let i = 0; i < symbolIndices.length; i++) {
    const current = symbolIndices[i];
    const nextLineIndex = i < symbolIndices.length - 1 ? symbolIndices[i + 1].lineIndex : lines.length;
    const chunkLines = lines.slice(current.lineIndex, nextLineIndex);

    // If chunk is too large, split with fallback
    if (estimateTokens(chunkLines.join("\n")) > FALLBACK_MAX_TOKENS) {
      const subChunks = tokenFallbackChunk(chunkLines, filePath, language, current.lineIndex + 1);
      chunks.push(...subChunks);
    } else {
      chunks.push({
        content: chunkLines.join("\n"),
        metadata: {
          filePath,
          language,
          type: current.type,
          name: current.name,
          startLine: current.lineIndex + 1,
          endLine: nextLineIndex,
        },
      });
    }
  }

  return chunks;
};

/**
 * Format chunk with metadata prefix for enriched vector embedding
 */
export const formatChunkForEmbedding = (chunk) => {
  const meta = chunk.metadata;
  return `
File: ${meta.filePath}
Language: ${meta.language}
Symbol: ${meta.name || "(module-level)"}
Type: ${meta.type}

${chunk.content}
`.trim();
};

/**
 * AI Service
 * Handles all interactions with the OpenAI API.
 * Supports streaming responses via Server-Sent Events (SSE).
 */

import OpenAI from "openai";
import { ANALYZE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from "../utils/prompts.js";

let _openai = null;
const getClient = () => {
  if (!_openai) {
    const options = { apiKey: process.env.OPENAI_API_KEY };
    
    // Support custom baseURL (e.g., OpenRouter, local models, etc.)
    if (process.env.OPENAI_BASE_URL) {
      options.baseURL = process.env.OPENAI_BASE_URL;
    } else if (process.env.OPENAI_API_KEY?.startsWith("sk-or-v1-")) {
      options.baseURL = "https://openrouter.ai/api/v1";
    }
    
    _openai = new OpenAI(options);
  }
  return _openai;
};

const getModel = () => {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY || "";
  
  // If using OpenRouter and model is a simple name without "/" (like "gpt-4o-mini"),
  // automatically prepend "openai/" to make it compatible with OpenRouter.
  if (apiKey.startsWith("sk-or-v1-") && !model.includes("/")) {
    return `openai/${model}`;
  }
  return model;
};

/**
 * Stream a repository analysis to the Express response object.
 * Uses Server-Sent Events (SSE) format.
 *
 * @param {string} repoContext - The full context string built from the repo
 * @param {object} res - Express response object
 * @param {string} lang - Selected language ('en' | 'vi')
 */
export const streamRepoAnalysis = async (repoContext, res, lang = 'en') => {
  const languageInstruction = lang === 'vi' 
    ? "IMPORTANT: You MUST write the entire response in Vietnamese (Tiếng Việt) but keep technical terms, commands, and code blocks as they are."
    : "IMPORTANT: You MUST write the entire response in English.";

  const stream = await getClient().chat.completions.create({
    model: getModel(),
    stream: true,
    messages: [
      { role: "system", content: `${ANALYZE_SYSTEM_PROMPT}\n\n${languageInstruction}` },
      {
        role: "user",
        content: `Please analyze this repository and provide a comprehensive guide:\n\n${repoContext}`,
      },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
};

/**
 * Stream a chat reply about a repository to the Express response object.
 * Uses Server-Sent Events (SSE) format.
 *
 * @param {string} repoContext - The repository context
 * @param {Array} history - Previous chat messages [{role, content}]
 * @param {string} userMessage - Current user message
 * @param {object} res - Express response object
 * @param {string} lang - Selected language ('en' | 'vi')
 */
export const streamRepoChat = async (repoContext, history, userMessage, res, lang = 'en') => {
  const languageInstruction = lang === 'vi' 
    ? "IMPORTANT: You MUST write the entire response in Vietnamese (Tiếng Việt) but keep technical terms, commands, and code blocks as they are."
    : "IMPORTANT: You MUST write the entire response in English.";

  const systemContent = `${CHAT_SYSTEM_PROMPT}
\n${languageInstruction}

Here is the repository context you have analyzed:

${repoContext}`;

  const messages = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const stream = await getClient().chat.completions.create({
    model: getModel(),
    stream: true,
    messages,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
};

/**
 * Stream RAG-enhanced chat reply about a repository
 */
export const streamRepoChatWithRAG = async (retrievedContext, sources, history, userMessage, res, lang = 'en') => {
  const languageInstruction = lang === 'vi' 
    ? "IMPORTANT: You MUST write the entire response in Vietnamese (Tiếng Việt) but keep technical terms, commands, and code blocks as they are."
    : "IMPORTANT: You MUST write the entire response in English.";

  const systemContent = `${CHAT_SYSTEM_PROMPT}
\n${languageInstruction}

Here is the relevant code context retrieved from the vector index:

${retrievedContext}`;

  // Emit source citations metadata first
  if (sources && sources.length > 0) {
    res.write(`data: ${JSON.stringify({ sources })}\n\n`);
  }

  const messages = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const stream = await getClient().chat.completions.create({
    model: getModel(),
    stream: true,
    messages,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
};

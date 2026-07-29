/**
 * Repo Service — Orchestration Layer
 * Combines GitHub, Indexer, Retrieval, and AI services to serve the API layer.
 */

import { buildRepoContext, parseGitHubUrl, getRepoInfo } from "./github.service.js";
import { streamRepoAnalysis, streamRepoChatWithRAG } from "./ai.service.js";
import { indexRepository } from "./indexer.service.js";
import { retrieveContext } from "./retrieval.service.js";
import { getManifest } from "./manifest.service.js";

/**
 * Fetch repo data + stream indexing progress + stream AI analysis
 */
export const analyzeRepoStream = async (url, res, lang = 'en', forceReindex = false) => {
  const { owner, repo } = parseGitHubUrl(url);
  const repoInfo = await getRepoInfo(owner, repo);

  // 1. Send repo metadata immediately
  res.write(`data: ${JSON.stringify({ meta: repoInfo })}\n\n`);

  // 2. Index repository (if not cached or if forceReindex is true)
  const indexResult = await indexRepository(
    url,
    (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    },
    forceReindex
  );

  // 3. Build top-level context for initial architecture overview
  const { context } = await buildRepoContext(url);

  // 4. Stream AI analysis
  await streamRepoAnalysis(context, res, lang);
};

/**
 * Stream RAG-enhanced AI chat response about a repo
 */
export const chatAboutRepoStream = async (url, history, userMessage, res, lang = 'en') => {
  const { owner, repo } = parseGitHubUrl(url);
  const repoKey = `github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;

  // 1. Ensure repo is indexed
  const indexResult = await indexRepository(url, null, false);
  const activeVersion = indexResult.manifest.activeVersion || indexResult.manifest.indexVersion;

  // 2. Retrieve relevant context & sources via Hybrid Search
  const { context, sources } = await retrieveContext(userMessage, repoKey, activeVersion, history);

  // 3. Stream RAG chat answer
  await streamRepoChatWithRAG(context, sources, history, userMessage, res, lang);
};

/**
 * Force re-index a repository and stream progress
 */
export const reindexRepoStream = async (url, res, lang = 'en') => {
  await analyzeRepoStream(url, res, lang, true);
};

/**
 * Get index status of a repository
 */
export const getRepoStatus = async (url) => {
  const { owner, repo, branch: urlBranch } = parseGitHubUrl(url);
  const repoKey = `github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const repoInfo = await getRepoInfo(owner, repo);
  const branch = urlBranch || repoInfo.defaultBranch || "main";

  const manifest = await getManifest(repoKey, branch);
  return {
    url,
    repoKey,
    indexed: Boolean(manifest && manifest.status === "ready"),
    manifest,
  };
};
/**
 * Indexer Service
 * Orchestrates fetching, chunking, embedding, vector storage, and atomic version swapping.
 */

import {
  parseGitHubUrl,
  getRepoInfo,
  getHeadCommitSha,
  getFilteredFileList,
  fetchFileContents,
} from "./github.service.js";
import { chunkFile, formatChunkForEmbedding } from "./chunker.service.js";
import { embedTexts } from "./embedding.service.js";
import { initCollection, upsertChunks } from "./vectorstore.service.js";
import {
  getManifest,
  isIndexValid,
  createManifest,
  updateManifest,
  swapActiveVersion,
} from "./manifest.service.js";

/**
 * Convert GitHub URL to canonical repoKey
 */
const getRepoKey = (owner, repo) => `github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;

/**
 * Index a repository with atomic versioning & progress callbacks
 * @param {string} url - GitHub repository URL
 * @param {function} onProgress - Progress callback ({ phase, current, total, message, cached })
 * @param {boolean} forceReindex - If true, bypasses cache validation
 * @param {string} tenantId - Tenant identifier
 */
export const indexRepository = async (url, onProgress, forceReindex = false, tenantId = "anonymous") => {
  const { owner, repo, branch: urlBranch } = parseGitHubUrl(url);
  const repoKey = getRepoKey(owner, repo);

  // 1. Fetch repo metadata & HEAD commit SHA
  const repoInfo = await getRepoInfo(owner, repo);
  const branch = urlBranch || repoInfo.defaultBranch || "main";
  const commitSha = await getHeadCommitSha(owner, repo, branch);

  // 2. Check manifest for valid cache
  const existingManifest = await getManifest(repoKey, branch, tenantId);

  if (!forceReindex && isIndexValid(existingManifest, commitSha)) {
    console.log(`[Indexer] Using cached index for ${repoKey} (SHA: ${commitSha.slice(0, 7)})`);
    if (onProgress) {
      onProgress({
        phase: "storing",
        current: existingManifest.fileCount,
        total: existingManifest.fileCount,
        message: "Using cached index",
        cached: true,
      });
    }
    return { cached: true, manifest: existingManifest, commitSha, repoKey, branch };
  }

  // 3. Initialize collection if needed
  await initCollection();

  // 4. Calculate new version for atomic swap
  const newVersion = (existingManifest?.indexVersion || 0) + 1;

  console.log(`[Indexer] Starting indexing for ${repoKey} (version ${newVersion}, SHA: ${commitSha.slice(0, 7)})...`);

  await createManifest({
    repoKey,
    ref: branch,
    commitSha,
    indexVersion: newVersion,
    tenantId,
  });

  try {
    // 5. Fetch & filter file tree
    if (onProgress) {
      onProgress({ phase: "fetching", current: 0, total: 100, message: "Fetching file tree...", cached: false });
    }

    const fileList = await getFilteredFileList(owner, repo, branch);

    if (fileList.length === 0) {
      throw new Error("No indexable source code files found in repository.");
    }

    // 6. Fetch file contents
    if (onProgress) {
      onProgress({ phase: "fetching", current: 0, total: fileList.length, message: `Fetching ${fileList.length} files...`, cached: false });
    }

    const fileContents = await fetchFileContents(owner, repo, fileList, (current, total) => {
      if (onProgress) {
        onProgress({ phase: "fetching", current, total, message: `Downloaded ${current}/${total} files`, cached: false });
      }
    });

    // 7. Chunk files
    const allChunks = [];
    const filesFetched = Object.keys(fileContents);

    if (onProgress) {
      onProgress({ phase: "chunking", current: 0, total: filesFetched.length, message: "Chunking source code...", cached: false });
    }

    let chunkedCount = 0;
    for (const [filePath, content] of Object.entries(fileContents)) {
      const fileChunks = chunkFile(filePath, content);
      for (const c of fileChunks) {
        c.metadata.ref = branch;
      }
      allChunks.push(...fileChunks);

      chunkedCount++;
      if (onProgress && chunkedCount % 10 === 0) {
        onProgress({ phase: "chunking", current: chunkedCount, total: filesFetched.length, message: `Chunked ${chunkedCount}/${filesFetched.length} files`, cached: false });
      }
    }

    if (allChunks.length === 0) {
      throw new Error("Failed to generate code chunks from repository.");
    }

    // 8. Generate Embeddings (format chunks with metadata for context enrichment)
    if (onProgress) {
      onProgress({ phase: "embedding", current: 0, total: allChunks.length, message: `Generating embeddings for ${allChunks.length} chunks...`, cached: false });
    }

    const formattedTexts = allChunks.map(formatChunkForEmbedding);
    const embeddings = await embedTexts(formattedTexts);

    // 9. Upsert to Qdrant under newVersion
    if (onProgress) {
      onProgress({ phase: "storing", current: 0, total: allChunks.length, message: "Storing vectors in Qdrant...", cached: false });
    }

    await upsertChunks(allChunks, embeddings, newVersion, repoKey, commitSha, tenantId);

    if (onProgress) {
      onProgress({ phase: "storing", current: allChunks.length, total: allChunks.length, message: "Indexing complete!", cached: false });
    }

    // 10. Atomic version swap: mark new version active and clean up old version
    await swapActiveVersion(repoKey, branch, newVersion, filesFetched.length, allChunks.length, tenantId);

    const finalManifest = await getManifest(repoKey, branch, tenantId);
    console.log(`[Indexer] Successfully indexed ${repoKey}: ${filesFetched.length} files, ${allChunks.length} chunks.`);

    return { cached: false, manifest: finalManifest, commitSha, repoKey, branch };
  } catch (err) {
    console.error(`[Indexer] Failed indexing ${repoKey}: ${err.message}`);
    // Mark manifest as failed without removing previous active version
    await updateManifest(repoKey, branch, { status: "failed", error: err.message }, tenantId);
    throw err;
  }
};

/**
 * Vector Store Service (Qdrant Integration)
 * Handles vector operations, payload indexes, and point management.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { v5 as uuidv5 } from "uuid";

// Fixed DNS Namespace for deterministic UUID v5 generation
const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

let _qdrantClient = null;

const getCollectionName = () => process.env.QDRANT_COLLECTION || "codebase_chunks";
const getDimensions = () => parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536;

export const getQdrantClient = () => {
  if (!_qdrantClient) {
    let url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url || url.includes("your-cluster.qdrant.io")) {
      console.warn("[Qdrant] QDRANT_URL is not configured properly in .env");
    }

    if (url && url.includes(".qdrant.io") && !url.includes(":6333") && !url.includes(":443")) {
      url = `${url.replace(/\/$/, "")}:6333`;
    }

    _qdrantClient = new QdrantClient({
      url: url || "http://localhost:6333",
      apiKey: apiKey && !apiKey.includes("your-qdrant-api-key") ? apiKey : undefined,
    });
  }
  return _qdrantClient;
};

/**
 * Generate a deterministic UUID v5 Point ID for Qdrant
 */
export const createPointId = ({ repoKey, commitSha, filePath, startLine, endLine, contentHash }) => {
  const seed = `${repoKey}:${commitSha || "head"}:${filePath}:${startLine}:${endLine}:${contentHash || ""}`;
  return uuidv5(seed, NAMESPACE_UUID);
};

/**
 * Initialize Qdrant collection and create payload indexes if not exists
 */
export const initCollection = async () => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();
  const dimensions = getDimensions();

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (!exists) {
      console.log(`[Qdrant] Creating collection "${collectionName}"...`);
      await client.createCollection(collectionName, {
        vectors: {
          size: dimensions,
          distance: "Cosine",
        },
      });

      // Create payload indexes for fast filtered searches
      const indexFields = [
        { name: "repoKey", schema: "keyword" },
        { name: "tenantId", schema: "keyword" },
        { name: "indexVersion", schema: "integer" },
        { name: "filePath", schema: "keyword" },
        { name: "name", schema: "keyword" },
        { name: "type", schema: "keyword" },
      ];

      for (const field of indexFields) {
        await client.createPayloadIndex(collectionName, {
          field_name: field.name,
          field_schema: field.schema,
        });
      }
      console.log(`[Qdrant] Collection "${collectionName}" created with payload indexes.`);
    }
  } catch (err) {
    console.error(`[Qdrant] Failed to initialize collection: ${err.message}`);
    throw err;
  }
};

/**
 * Upsert chunks and embeddings into Qdrant
 */
export const upsertChunks = async (chunks, embeddings, indexVersion, repoKey, commitSha, tenantId = "anonymous") => {
  if (!chunks || chunks.length === 0) return;
  const client = getQdrantClient();
  const collectionName = getCollectionName();

  const points = chunks.map((chunk, i) => {
    const pointId = createPointId({
      repoKey,
      commitSha,
      filePath: chunk.metadata.filePath,
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine,
      contentHash: chunk.metadata.contentHash,
    });

    return {
      id: pointId,
      vector: embeddings[i],
      payload: {
        chunkKey: `${repoKey}:${chunk.metadata.filePath}:${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
        tenantId,
        repoKey,
        ref: chunk.metadata.ref || "main",
        commitSha,
        indexVersion,
        filePath: chunk.metadata.filePath,
        language: chunk.metadata.language,
        type: chunk.metadata.type,
        name: chunk.metadata.name || "",
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        content: chunk.content,
      },
    };
  });

  // Batch upsert (100 points per batch)
  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await client.upsert(collectionName, { points: batch });
  }
};

/**
 * Perform vector search with filters
 */
export const searchVectors = async (queryEmbedding, repoKey, indexVersion, topK = 10, tenantId = "anonymous") => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();

  const filter = {
    must: [
      { key: "repoKey", match: { value: repoKey } },
      { key: "tenantId", match: { value: tenantId } },
      { key: "indexVersion", match: { value: indexVersion } },
    ],
  };

  const results = await client.search(collectionName, {
    vector: queryEmbedding,
    filter,
    limit: topK,
    with_payload: true,
  });

  return results.map((res) => ({
    score: res.score,
    ...res.payload,
  }));
};

/**
 * Exact match search for filenames or symbol names
 */
export const searchExact = async (repoKey, indexVersion, field, value, topK = 5, tenantId = "anonymous") => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();

  const filter = {
    must: [
      { key: "repoKey", match: { value: repoKey } },
      { key: "tenantId", match: { value: tenantId } },
      { key: "indexVersion", match: { value: indexVersion } },
      { key: field, match: { value } },
    ],
  };

  const results = await client.scroll(collectionName, {
    filter,
    limit: topK,
    with_payload: true,
  });

  return (results.points || []).map((res) => res.payload);
};

/**
 * Delete chunks of a specific index version
 */
export const deleteByVersion = async (repoKey, indexVersion, tenantId = "anonymous") => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();

  await client.delete(collectionName, {
    filter: {
      must: [
        { key: "repoKey", match: { value: repoKey } },
        { key: "tenantId", match: { value: tenantId } },
        { key: "indexVersion", match: { value: indexVersion } },
      ],
    },
  });
};

/**
 * Delete all points associated with a repository
 */
export const deleteByRepo = async (repoKey, tenantId = "anonymous") => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();

  await client.delete(collectionName, {
    filter: {
      must: [
        { key: "repoKey", match: { value: repoKey } },
        { key: "tenantId", match: { value: tenantId } },
      ],
    },
  });
};

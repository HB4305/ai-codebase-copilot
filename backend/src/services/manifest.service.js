/**
 * Manifest Service
 * Tracks repository index metadata, status, commit SHAs, and active versions in Qdrant.
 */

import { getQdrantClient, createPointId, deleteByVersion } from "./vectorstore.service.js";

const getCollectionName = () => process.env.QDRANT_COLLECTION || "codebase_chunks";
const getSchemaVersion = () => parseInt(process.env.INDEX_SCHEMA_VERSION) || 1;
const getEmbeddingModel = () => process.env.EMBEDDING_MODEL || "text-embedding-3-small";

/**
 * Generate a deterministic UUID v5 Point ID for a repository manifest
 */
const getManifestPointId = (repoKey, ref = "main", tenantId = "anonymous") => {
  return createPointId({
    repoKey,
    commitSha: `manifest:${ref}:${tenantId}`,
    filePath: "_manifest.json",
    startLine: 0,
    endLine: 0,
    contentHash: "manifest",
  });
};

/**
 * Fetch manifest for a repo
 */
export const getManifest = async (repoKey, ref = "main", tenantId = "anonymous") => {
  try {
    const client = getQdrantClient();
    const collectionName = getCollectionName();
    const pointId = getManifestPointId(repoKey, ref, tenantId);

    const points = await client.retrieve(collectionName, {
      ids: [pointId],
      with_payload: true,
    });

    if (points && points.length > 0) {
      return points[0].payload;
    }
    return null;
  } catch (err) {
    // If collection doesn't exist yet, return null
    return null;
  }
};

/**
 * Check if an index manifest is valid for reuse
 */
export const isIndexValid = (manifest, currentCommitSha) => {
  if (!manifest) return false;
  return (
    manifest.status === "ready" &&
    manifest.commitSha === currentCommitSha &&
    manifest.embeddingModel === getEmbeddingModel() &&
    manifest.schemaVersion === getSchemaVersion()
  );
};

/**
 * Create or overwrite manifest entry (starts with status: "indexing")
 */
export const createManifest = async ({
  repoKey,
  ref = "main",
  commitSha,
  indexVersion = 1,
  tenantId = "anonymous",
}) => {
  const client = getQdrantClient();
  const collectionName = getCollectionName();
  const pointId = getManifestPointId(repoKey, ref, tenantId);

  const manifestPayload = {
    type: "_manifest",
    tenantId,
    repoKey,
    ref,
    commitSha,
    indexVersion,
    activeVersion: indexVersion - 1 > 0 ? indexVersion - 1 : 0,
    embeddingProvider: process.env.EMBEDDING_PROVIDER || "openai",
    embeddingModel: getEmbeddingModel(),
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536,
    schemaVersion: getSchemaVersion(),
    status: "indexing",
    fileCount: 0,
    chunkCount: 0,
    indexedAt: new Date().toISOString(),
  };

  // Upsert zero vector for manifest point
  const zeroVector = new Array(manifestPayload.dimensions).fill(0);

  await client.upsert(collectionName, {
    points: [
      {
        id: pointId,
        vector: zeroVector,
        payload: manifestPayload,
      },
    ],
  });

  return manifestPayload;
};

/**
 * Update specific fields in an existing manifest
 */
export const updateManifest = async (repoKey, ref = "main", updates = {}, tenantId = "anonymous") => {
  const current = await getManifest(repoKey, ref, tenantId);
  if (!current) return null;

  const client = getQdrantClient();
  const collectionName = getCollectionName();
  const pointId = getManifestPointId(repoKey, ref, tenantId);

  const updatedPayload = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const zeroVector = new Array(updatedPayload.dimensions || 1536).fill(0);

  await client.upsert(collectionName, {
    points: [
      {
        id: pointId,
        vector: zeroVector,
        payload: updatedPayload,
      },
    ],
  });

  return updatedPayload;
};

/**
 * Atomic version swap: Mark new version active, then delete old version chunks
 */
export const swapActiveVersion = async (repoKey, ref = "main", newVersion, fileCount, chunkCount, tenantId = "anonymous") => {
  const current = await getManifest(repoKey, ref, tenantId);
  const oldVersion = current?.activeVersion || 0;

  // 1. Update manifest to mark new version active and ready
  await updateManifest(
    repoKey,
    ref,
    {
      status: "ready",
      indexVersion: newVersion,
      activeVersion: newVersion,
      fileCount,
      chunkCount,
      indexedAt: new Date().toISOString(),
    },
    tenantId
  );

  // 2. Delete chunks of old version if oldVersion > 0
  if (oldVersion > 0 && oldVersion !== newVersion) {
    console.log(`[Manifest] Deleting old index version ${oldVersion} for ${repoKey}...`);
    try {
      await deleteByVersion(repoKey, oldVersion, tenantId);
    } catch (err) {
      console.warn(`[Manifest] Failed to delete old version chunks: ${err.message}`);
    }
  }
};

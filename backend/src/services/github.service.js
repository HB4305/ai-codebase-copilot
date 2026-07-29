/**
 * GitHub Service
 * Handles all interactions with the GitHub REST API.
 */

const GITHUB_API_BASE = "https://api.github.com";

const getHeaders = () => ({
  "User-Agent": "ai-codebase-copilot",
  Accept: "application/vnd.github.v3+json",
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
});

// Key files to fetch content for AI context
const KEY_FILES = [
  "README.md",
  "readme.md",
  "Readme.md",
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Makefile",
  ".env.example",
  ".env.sample",
  "docker-compose.dev.yml",
  "CONTRIBUTING.md",
  "ARCHITECTURE.md",
];

/**
 * Parse a GitHub URL into { owner, repo, branch }
 * Supports:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo.git
 *  - https://github.com/owner/repo/tree/branch-name
 *  - github.com/owner/repo
 */
export const parseGitHubUrl = (url) => {
  // Normalize: remove protocol and trailing slashes
  const cleaned = url
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const parts = cleaned.split("/");

  if (parts[0] !== "github.com" || parts.length < 3) {
    throw new Error(
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
    );
  }

  const owner = parts[1];
  const repo = parts[2];
  // If URL is .../tree/{branch}, capture it; otherwise default to HEAD
  const branch = parts[3] === "tree" && parts[4] ? parts[4] : null;

  return { owner, repo, branch };
};

/**
 * Fetch general repository metadata
 */
export const getRepoInfo = async (owner, repo) => {
  const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" not found or is private.`);
    }
    if (res.status === 403) {
      throw new Error("GitHub API rate limit exceeded. Please try again later.");
    }
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    fullName: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    topics: data.topics,
    defaultBranch: data.default_branch,
    homepage: data.homepage,
    license: data.license?.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    size: data.size,
    openIssues: data.open_issues_count,
  };
};

/**
 * Fetch the full file tree of the repository
 */
export const getRepoTree = async (owner, repo, branch) => {
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch repo tree: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  if (data.truncated) {
    console.warn("Repository tree was truncated due to size.");
  }

  // Return only file paths (blobs), not directories
  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path);
};

/**
 * Fetch the raw content of a single file
 */
export const getFileContent = async (owner, repo, path) => {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      { headers: getHeaders() }
    );

    if (!res.ok) return null;

    const data = await res.json();

    if (data.encoding === "base64" && data.content) {
      // Decode base64 content
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      // Limit file size to avoid huge token counts
      return decoded.length > 8000 ? decoded.slice(0, 8000) + "\n...(truncated)" : decoded;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Build a complete context string for the AI from the repository
 */
export const buildRepoContext = async (url) => {
  const { owner, repo, branch: urlBranch } = parseGitHubUrl(url);

  // 1. Fetch repo metadata
  const repoInfo = await getRepoInfo(owner, repo);
  const branch = urlBranch || repoInfo.defaultBranch;

  // 2. Fetch file tree
  const allFiles = await getRepoTree(owner, repo, branch);

  // 3. Fetch key file contents
  const fileContents = {};
  const foundKeyFiles = allFiles.filter((f) =>
    KEY_FILES.some((k) => f === k || f.endsWith("/" + k))
  );

  await Promise.allSettled(
    foundKeyFiles.map(async (filePath) => {
      const content = await getFileContent(owner, repo, filePath);
      if (content) {
        fileContents[filePath] = content;
      }
    })
  );

  // 4. Build structured context string
  const fileTree = allFiles.slice(0, 300).join("\n"); // Cap at 300 files

  const keyFilesSection = Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  const context = `
# Repository: ${repoInfo.fullName}

## Metadata
- Description: ${repoInfo.description || "N/A"}
- Primary Language: ${repoInfo.language || "N/A"}
- Stars: ${repoInfo.stars} | Forks: ${repoInfo.forks}
- License: ${repoInfo.license || "N/A"}
- Topics: ${repoInfo.topics?.join(", ") || "N/A"}
- Homepage: ${repoInfo.homepage || "N/A"}
- Default Branch: ${branch}
- Open Issues: ${repoInfo.openIssues}

## File Structure (first 300 files)
\`\`\`
${fileTree}
\`\`\`

## Key File Contents
${keyFilesSection || "No key configuration files found."}
`.trim();

  return { context, repoInfo, owner, repo, branch };
};

/**
 * Fetch the HEAD commit SHA for a branch
 */
export const getHeadCommitSha = async (owner, repo, branch) => {
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${branch}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch HEAD commit: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.sha;
};

/**
 * Fetch and filter file tree for indexing, prioritized by entry points and configs
 */
export const getFilteredFileList = async (owner, repo, branch) => {
  const { isDenylisted } = await import("../utils/denylist.js");
  const { isIndexableFile } = await import("./chunker.service.js");

  const allFiles = await getRepoTree(owner, repo, branch);

  const filtered = allFiles.filter((filePath) => !isDenylisted(filePath) && isIndexableFile(filePath));

  // Sort by priority: KEY_FILES first, then shallow paths, then deeper paths
  const maxFiles = parseInt(process.env.INDEX_MAX_FILES) || 200;

  filtered.sort((a, b) => {
    const aIsKey = KEY_FILES.some((k) => a === k || a.endsWith("/" + k));
    const bIsKey = KEY_FILES.some((k) => b === k || b.endsWith("/" + k));
    if (aIsKey && !bIsKey) return -1;
    if (!aIsKey && bIsKey) return 1;

    const aDepth = a.split("/").length;
    const bDepth = b.split("/").length;
    return aDepth - bDepth;
  });

  return filtered.slice(0, maxFiles);
};

/**
 * Fetch contents of multiple files using a concurrency queue (max 5)
 */
export const fetchFileContents = async (owner, repo, filePaths, onProgress) => {
  const maxFileBytes = parseInt(process.env.INDEX_MAX_FILE_BYTES) || 60000;
  const results = {};
  const queue = [...filePaths];
  const concurrency = 5;
  let completed = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const filePath = queue.shift();
      if (!filePath) break;

      try {
        const content = await getFileContent(owner, repo, filePath);
        if (content && content.length <= maxFileBytes) {
          results[filePath] = content;
        }
      } catch (err) {
        console.warn(`[GitHub] Failed to fetch ${filePath}: ${err.message}`);
      }

      completed++;
      if (onProgress) {
        onProgress(completed, filePaths.length);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, filePaths.length) }, () => worker());
  await Promise.all(workers);

  return results;
};

// ─── Domain Types ─────────────────────────────────────────────────

export interface RepoMeta {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  defaultBranch: string;
  homepage: string | null;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  size: number;
  openIssues: number;
}

export interface SourceCitation {
  filePath: string;
  startLine: number;
  endLine: number;
  name?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  sources?: SourceCitation[];
}

export type Language = 'en' | 'vi';

export interface IndexProgress {
  phase: 'fetching' | 'chunking' | 'embedding' | 'storing';
  current: number;
  total: number;
  message: string;
  cached?: boolean;
}

// ─── App State ────────────────────────────────────────────────────

export type AppPhase = 'landing' | 'indexing' | 'analyzing' | 'done';

// ─── API Callback Types ───────────────────────────────────────────

export interface AnalyzeCallbacks {
  onMeta?: (meta: RepoMeta) => void;
  onProgress?: (progress: IndexProgress) => void;
  onDelta?: (delta: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

export interface ChatCallbacks {
  onSources?: (sources: SourceCitation[]) => void;
  onDelta?: (delta: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

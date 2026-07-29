import type {
  AnalyzeCallbacks,
  ChatCallbacks,
  ChatMessage,
  Language,
  IndexProgress,
  SourceCitation,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

// ─── Analyze ──────────────────────────────────────────────────────

export async function analyzeRepo(
  url: string,
  lang: Language,
  callbacks: AnalyzeCallbacks,
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/repo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, lang }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? `Server error: ${response.status}`);
    }

    await readSSEStream(response, callbacks);
  } catch (err) {
    callbacks.onError?.((err as Error).message ?? 'An unexpected error occurred.');
  }
}

// ─── Re-index ─────────────────────────────────────────────────────

export async function reindexRepo(
  url: string,
  lang: Language,
  callbacks: AnalyzeCallbacks,
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/repo/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, lang }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? `Server error: ${response.status}`);
    }

    await readSSEStream(response, callbacks);
  } catch (err) {
    callbacks.onError?.((err as Error).message ?? 'An unexpected error occurred.');
  }
}

// ─── Check Status ─────────────────────────────────────────────────

export async function checkRepoStatus(url: string): Promise<{ indexed: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/repo/status?url=${encodeURIComponent(url)}`);
    if (!response.ok) return { indexed: false };
    return await response.json();
  } catch {
    return { indexed: false };
  }
}

// ─── Chat ─────────────────────────────────────────────────────────

export async function chatAboutRepo(
  url: string,
  message: string,
  history: Pick<ChatMessage, 'role' | 'content'>[],
  lang: Language,
  callbacks: ChatCallbacks,
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/repo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, message, history, lang }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? `Server error: ${response.status}`);
    }

    await readSSEStream(response, callbacks);
  } catch (err) {
    callbacks.onError?.((err as Error).message ?? 'An unexpected error occurred.');
  }
}

// ─── Internal SSE Reader ──────────────────────────────────────────

type SSECallbacks = AnalyzeCallbacks & ChatCallbacks;

async function readSSEStream(response: Response, callbacks: SSECallbacks): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.meta) callbacks.onMeta?.(parsed.meta as Parameters<NonNullable<AnalyzeCallbacks['onMeta']>>[0]);
        if (parsed.progress) callbacks.onProgress?.(parsed.progress as IndexProgress);
        if (parsed.sources) callbacks.onSources?.(parsed.sources as SourceCitation[]);
        if (typeof parsed.delta === 'string') callbacks.onDelta?.(parsed.delta);
        if (parsed.done) callbacks.onDone?.();
        if (typeof parsed.error === 'string') callbacks.onError?.(parsed.error);
      } catch {
        // ignore malformed JSON lines
      }
    }
  }
}

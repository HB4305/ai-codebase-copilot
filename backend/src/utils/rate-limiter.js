/**
 * Rate Limiter Utility
 * Tracks IP request timestamps and calculates remaining quota for analyze and chat operations.
 */

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const maxAnalyze = parseInt(process.env.RATE_LIMIT_MAX_ANALYZE) || 5;
const maxChat = parseInt(process.env.RATE_LIMIT_MAX_CHAT) || 60;

const ipStore = new Map();

function cleanUpHits(hits, now) {
  return hits.filter(time => now - time < windowMs);
}

export function checkAndRecordHit(ip, type) {
  const now = Date.now();
  if (!ipStore.has(ip)) {
    ipStore.set(ip, { analyze: [], chat: [] });
  }
  const record = ipStore.get(ip);
  record.analyze = cleanUpHits(record.analyze, now);
  record.chat = cleanUpHits(record.chat, now);

  const limit = type === "analyze" ? maxAnalyze : maxChat;
  const hits = record[type];

  if (hits.length >= limit) {
    const oldestHit = hits[0];
    const resetInMs = Math.max(0, windowMs - (now - oldestHit));
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetInMs,
    };
  }

  hits.push(now);
  return {
    allowed: true,
    remaining: limit - hits.length,
    limit,
    resetInMs: windowMs,
  };
}

export function getRemainingQuota(ip) {
  const now = Date.now();
  if (!ipStore.has(ip)) {
    return {
      analyze: { remaining: maxAnalyze, limit: maxAnalyze },
      chat: { remaining: maxChat, limit: maxChat },
    };
  }
  const record = ipStore.get(ip);
  const analyzeHits = cleanUpHits(record.analyze, now);
  const chatHits = cleanUpHits(record.chat, now);

  return {
    analyze: { remaining: Math.max(0, maxAnalyze - analyzeHits.length), limit: maxAnalyze },
    chat: { remaining: Math.max(0, maxChat - chatHits.length), limit: maxChat },
  };
}

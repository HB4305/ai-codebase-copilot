import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppPhase, ChatMessage, RepoMeta, Language, IndexProgress, SourceCitation, QuotaLimits } from './types';
import { analyzeRepo, chatAboutRepo, reindexRepo, fetchQuotaLimits } from './lib/api';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { RepoMetaCard } from './components/RepoMetaCard';
import { IndexingProgress } from './components/IndexingProgress';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ChatPanel } from './components/ChatPanel';
import { SpinnerIcon } from './components/Icons';
import { GravityCanvas } from './components/GravityCanvas';
import styles from './App.module.css';

// ─── Features section ─────────────────────────────────────────────

const FEATURES_TRANSLATIONS = {
  en: [
    { icon: '🔍', title: 'Instant Analysis', desc: 'Get a complete breakdown of any public GitHub repo in seconds.' },
    { icon: '🛠', title: 'Setup Guide', desc: 'Step-by-step instructions to run the project locally, every time.' },
    { icon: '🏗', title: 'Architecture Map', desc: 'Understand folder structure, patterns, and key entry points.' },
    { icon: '💬', title: 'Interactive RAG Chat', desc: 'Ask questions with precise code vector search and line citations.' },
  ],
  vi: [
    { icon: '🔍', title: 'Phân tích tức thì', desc: 'Nhận bảng phân tích chi tiết của bất kỳ repo GitHub công khai nào chỉ trong vài giây.' },
    { icon: '🛠', title: 'Hướng dẫn cài đặt', desc: 'Các bước hướng dẫn chi tiết để chạy dự án trên máy cục bộ của bạn.' },
    { icon: '🏗', title: 'Bản đồ cấu trúc', desc: 'Hiểu cấu trúc thư mục, các mẫu thiết kế và các file quan trọng.' },
    { icon: '💬', title: 'Hỏi đáp RAG thông minh', desc: 'Tìm kiếm ngữ nghĩa theo dòng code thực tế và trích dẫn nguồn chính xác.' },
  ],
};

interface FeaturesSectionProps {
  lang: Language;
}

function FeaturesSection({ lang }: FeaturesSectionProps) {
  const items = FEATURES_TRANSLATIONS[lang];
  return (
    <section className={styles.features}>
      <div className={styles.featuresGrid}>
        {items.map((f) => (
          <div key={f.title} className={`glass-card ${styles.featureCard}`}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── TRANSLATIONS FOR APP LAYOUT ─────────────────────────────────

const LAYOUT_TRANSLATIONS = {
  en: {
    back: '← Back',
    analyzing: 'Indexing & analyzing repository…',
    footer: 'WEB OF HB4305',
  },
  vi: {
    back: '← Quay lại',
    analyzing: 'Đang index & phân tích mã nguồn…',
    footer: 'WEB CỦA HB4305',
  },
};

// ─── App ─────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('codecopilot_lang');
      if (saved === 'en' || saved === 'vi') return saved;
    }
    return 'vi';
  });
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<AppPhase>('landing');
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [repoMeta, setRepoMeta] = useState<RepoMeta | null>(null);
  const [streamingDone, setStreamingDone] = useState(false);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<Pick<ChatMessage, 'role' | 'content'>[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [quota, setQuota] = useState<QuotaLimits | null>(null);

  const refreshQuota = useCallback(() => {
    fetchQuotaLimits().then((data) => {
      if (data) setQuota(data);
    });
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [phase, refreshQuota]);

  const t = LAYOUT_TRANSLATIONS[lang];

  const handleLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('codecopilot_lang', newLang);
  };

  // Use a ref for the accumulating text to avoid stale closures in async callbacks
  const analysisRef = useRef('');

  // ─── Handlers ─────────────────────────────────────────────────

  const startAnalysis = useCallback(
    async (targetUrl: string) => {
      const trimmedUrl = targetUrl.trim();
      if (!trimmedUrl) return;

      // Sync URL param in browser address bar
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('repo') !== trimmedUrl) {
          searchParams.set('repo', trimmedUrl);
          window.history.pushState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
        }
      }

      // Reset
      setError('');
      setAnalysisText('');
      setRepoMeta(null);
      setIndexProgress(null);
      setStreamingDone(false);
      setChatMessages([]);
      setChatHistory([]);
      analysisRef.current = '';
      setPhase('indexing');

      await analyzeRepo(trimmedUrl, lang, {
        onMeta: (meta) => setRepoMeta(meta),
        onProgress: (progress) => {
          setIndexProgress(progress);
          if (progress.phase === 'storing' && progress.current === progress.total) {
            setPhase('analyzing');
          }
        },
        onDelta: (delta) => {
          setPhase('analyzing');
          analysisRef.current += delta;
          setAnalysisText(analysisRef.current);
        },
        onDone: () => {
          setStreamingDone(true);
          setPhase('done');
        },
        onError: (msg) => {
          setError(msg);
          setPhase('landing');
        },
      });
    },
    [lang],
  );

  const handleAnalyze = useCallback(() => {
    startAnalysis(url);
  }, [startAnalysis, url]);

  // Initial load check for ?repo=... parameter in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const repoParam = searchParams.get('repo');
    if (repoParam) {
      setUrl(repoParam);
      startAnalysis(repoParam);
    }
  }, [startAnalysis]);

  const handleReindex = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setError('');
    setStreamingDone(false);
    setIndexProgress(null);
    analysisRef.current = '';
    setPhase('indexing');

    await reindexRepo(trimmedUrl, lang, {
      onMeta: (meta) => setRepoMeta(meta),
      onProgress: (progress) => setIndexProgress(progress),
      onDelta: (delta) => {
        setPhase('analyzing');
        analysisRef.current += delta;
        setAnalysisText(analysisRef.current);
      },
      onDone: () => {
        setStreamingDone(true);
        setPhase('done');
      },
      onError: (msg) => {
        setError(msg);
      },
    });
  }, [url, lang]);

  const handleChatSend = useCallback(
    async (message: string) => {
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setChatLoading(true);

      setChatMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

      let aiContent = '';
      let currentSources: SourceCitation[] = [];

      await chatAboutRepo(url, message, chatHistory, lang, {
        onSources: (sources) => {
          currentSources = sources;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: aiContent,
              sources: currentSources,
              streaming: true,
            };
            return updated;
          });
        },
        onDelta: (delta) => {
          aiContent += delta;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: aiContent,
              sources: currentSources,
              streaming: true,
            };
            return updated;
          });
        },
        onDone: () => {
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: aiContent,
              sources: currentSources,
              streaming: false,
            };
            return updated;
          });
          setChatHistory((prev) => [
            ...prev,
            { role: 'user', content: message },
            { role: 'assistant', content: aiContent },
          ]);
          setChatLoading(false);
        },
        onError: (msg) => {
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `⚠️ Error: ${msg}`,
              streaming: false,
            };
            return updated;
          });
          setChatLoading(false);
        },
      });
    },
    [url, chatHistory, lang],
  );

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', window.location.pathname);
    }
    setPhase('landing');
    setUrl('');
    setAnalysisText('');
    setRepoMeta(null);
    setIndexProgress(null);
    setError('');
    setChatMessages([]);
    setChatHistory([]);
    analysisRef.current = '';
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <GravityCanvas />
      <Header lang={lang} onLangChange={handleLangChange} quota={quota} />

      {/* ── Landing ── */}
      {phase === 'landing' && (
        <main className={styles.main}>
          <HeroSection url={url} setUrl={setUrl} onAnalyze={handleAnalyze} loading={false} lang={lang} quota={quota} />
          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          <FeaturesSection lang={lang} />
        </main>
      )}

      {/* ── Indexing / Analyzing / Done ── */}
      {(phase === 'indexing' || phase === 'analyzing' || phase === 'done') && (
        <main className={`${styles.main} ${styles.mainAnalysis}`}>
          {/* Top bar */}
          <div className={styles.topBar}>
            <div className={styles.breadcrumb}>
              <button className={styles.backBtn} onClick={handleReset}>{t.back}</button>
              <span className={styles.sep}>/</span>
              <span className={styles.breadcrumbUrl}>{url}</span>
              {indexProgress?.cached && (
                <span className="badge badge-green" style={{ marginLeft: '6px' }}>
                  Vector DB: Cached ✓
                </span>
              )}
              {phase === 'done' && !indexProgress?.cached && (
                <span className="badge badge-purple" style={{ marginLeft: '6px' }}>
                  Vector DB: Indexed ✓
                </span>
              )}
            </div>
            {(phase === 'indexing' || phase === 'analyzing') && (
              <div className={styles.analyzingStatus}>
                <SpinnerIcon className="spinner-purple" size={16} />
                <span>{t.analyzing}</span>
              </div>
            )}
          </div>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {repoMeta && <RepoMetaCard meta={repoMeta} />}

          {indexProgress && (phase === 'indexing' || (phase === 'analyzing' && !streamingDone && !indexProgress.cached)) && (
            <IndexingProgress progress={indexProgress} lang={lang} />
          )}

          <div className={styles.analysisLayout}>
            <AnalysisPanel
              content={analysisText}
              loading={phase === 'indexing' || phase === 'analyzing'}
              streamingDone={streamingDone}
              lang={lang}
              onReindex={handleReindex}
            />
            {phase === 'done' && (
              <ChatPanel
                messages={chatMessages}
                onSend={handleChatSend}
                loading={chatLoading}
                lang={lang}
              />
            )}
          </div>
        </main>
      )}

      <footer className={styles.footer}>
        {t.footer}
      </footer>
    </div>
  );
}

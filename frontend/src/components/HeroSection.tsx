import type { FC, KeyboardEvent } from 'react';
import type { Language, QuotaLimits } from '../types';
import { GithubIcon, SpinnerIcon } from './Icons';
import styles from './HeroSection.module.css';

interface HeroSectionProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  lang: Language;
  quota?: QuotaLimits | null;
}

const EXAMPLES = ['facebook/react', 'vercel/next.js', 'expressjs/express'];

const TRANSLATIONS = {
  en: {
    badge: 'AI-Powered Repository Analysis',
    titleMain: 'Understand any',
    titleHighlight: 'GitHub repo',
    titleSuffix: ' instantly',
    subtitle: 'Drop a GitHub URL and get a full breakdown: tech stack, architecture, setup guide, and an AI assistant ready to answer your questions.',
    placeholder: 'https://github.com/owner/repository',
    analyze: 'Analyze →',
    analyzing: 'Analyzing…',
    try: 'Try:',
  },
  vi: {
    badge: 'Phân tích mã nguồn bằng AI',
    titleMain: 'Hiểu mọi',
    titleHighlight: 'kho lưu trữ GitHub',
    titleSuffix: ' ngay lập tức',
    subtitle: 'Nhập URL GitHub để có bảng phân tích chi tiết: công nghệ sử dụng, kiến trúc, hướng dẫn cài đặt và trợ lý AI sẵn sàng giải đáp thắc mắc.',
    placeholder: 'https://github.com/owner/repository',
    analyze: 'Phân tích →',
    analyzing: 'Đang phân tích…',
    try: 'Gợi ý:',
  },
};

export const HeroSection: FC<HeroSectionProps> = ({ url, setUrl, onAnalyze, loading, lang, quota }) => {
  const t = TRANSLATIONS[lang];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) onAnalyze();
  };

  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.content}>
        <span className={`badge badge-purple ${styles.badge}`}>
          <span>{t.badge}</span>
        </span>

        <h1 className={styles.title}>
          {t.titleMain}
          <br />
          <span className="gradient-text">{t.titleHighlight}</span>
          {t.titleSuffix}
        </h1>

        <p className={styles.subtitle}>
          {t.subtitle}
        </p>

        <div className={styles.inputGroup}>
          <span className={styles.inputIcon}>
            <GithubIcon size={20} />
          </span>
          <input
            id="repo-url-input"
            className={styles.input}
            type="url"
            placeholder={t.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
          />
          <button
            id="analyze-btn"
            className={styles.analyzeBtn}
            onClick={onAnalyze}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <SpinnerIcon size={16} />
                {t.analyzing}
              </>
            ) : (
              <>{t.analyze}</>
            )}
          </button>
        </div>

        {quota && (
          <div className={styles.quotaRow}>
            <span className="badge badge-purple" style={{ padding: '6px 14px', fontSize: '13px' }}>
              ⚡ {lang === 'vi' ? `Hạn mức phân tích: ${quota.analyze.remaining}/${quota.analyze.limit} lượt / 15 phút` : `Analyze quota: ${quota.analyze.remaining}/${quota.analyze.limit} per 15 min`}
            </span>
            <span className="badge badge-blue" style={{ padding: '6px 14px', fontSize: '13px' }}>
              💬 {lang === 'vi' ? `Hạn mức chat AI: ${quota.chat.remaining}/${quota.chat.limit} lượt / 15 phút` : `Chat quota: ${quota.chat.remaining}/${quota.chat.limit} per 15 min`}
            </span>
          </div>
        )}

        <p className={styles.hint}>
          {t.try}&nbsp;
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className={styles.exampleChip}
              onClick={() => setUrl(`https://github.com/${ex}`)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </p>
      </div>
    </section>
  );
};

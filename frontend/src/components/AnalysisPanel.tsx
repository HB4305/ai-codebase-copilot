import type { FC } from 'react';
import type { Language } from '../types';
import { markdownToHtml } from '../lib/markdown';
import { SpinnerIcon } from './Icons';
import styles from './AnalysisPanel.module.css';

interface AnalysisPanelProps {
  content: string;
  loading: boolean;
  streamingDone: boolean;
  lang: Language;
  onReindex?: () => void;
}

const TRANSLATIONS = {
  en: {
    title: 'Analysis',
    generating: 'Generating…',
    complete: '✓ Complete',
    reindex: '🔄 Re-index',
  },
  vi: {
    title: 'Phân tích',
    generating: 'Đang tạo…',
    complete: '✓ Hoàn tất',
    reindex: '🔄 Re-index',
  },
};

export const AnalysisPanel: FC<AnalysisPanelProps> = ({
  content,
  loading,
  streamingDone,
  lang,
  onReindex,
}) => {
  const html = markdownToHtml(content);
  const t = TRANSLATIONS[lang];

  return (
    <div className={`glass-card ${styles.panel}`}>
      <div className={styles.header}>
        <span className={styles.title}>
          <span>📊</span> {t.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && !streamingDone && (
            <span className={styles.status}>
              <SpinnerIcon className="spinner-purple" size={14} />
              {t.generating}
            </span>
          )}
          {streamingDone && (
            <>
              <span className="badge badge-green">{t.complete}</span>
              {onReindex && (
                <button
                  onClick={onReindex}
                  disabled={loading}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title="Force re-indexing of this repository"
                >
                  {t.reindex}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {content ? (
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className={styles.skeleton}>
            {([80, 60, 90, 50, 70, 65, 85] as const).map((w, i) => (
              <div
                key={i}
                className={styles.skeletonLine}
                style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

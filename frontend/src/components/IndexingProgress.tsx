import type { FC } from 'react';
import type { IndexProgress, Language } from '../types';
import styles from './IndexingProgress.module.css';

interface IndexingProgressProps {
  progress: IndexProgress;
  lang: Language;
}

const PHASE_NAMES = {
  en: {
    fetching: 'Fetching Repository Files',
    chunking: 'Chunking Source Code',
    embedding: 'Generating Vector Embeddings',
    storing: 'Storing in Qdrant Vector DB',
  },
  vi: {
    fetching: 'Tải danh sách tệp nguồn',
    chunking: 'Phân đoạn mã nguồn (Chunking)',
    embedding: 'Tạo nhúng Vector (Embeddings)',
    storing: 'Lưu trữ vào Vector DB (Qdrant)',
  },
};

export const IndexingProgress: FC<IndexingProgressProps> = ({ progress, lang }) => {
  const percent = progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  const phaseTitle = PHASE_NAMES[lang][progress.phase] || progress.phase;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.phaseTitle}>{phaseTitle}</span>
          {progress.cached && (
            <span className="badge badge-green">Cached ✓</span>
          )}
        </div>
        <span className={styles.counter}>
          {progress.current} / {progress.total} ({percent}%)
        </span>
      </div>

      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>

      <div className={styles.message}>{progress.message}</div>
    </div>
  );
};

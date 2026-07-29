import type { FC } from 'react';
import type { RepoMeta } from '../types';
import { GithubIcon } from './Icons';
import styles from './RepoMetaCard.module.css';

interface RepoMetaCardProps {
  meta: RepoMeta;
}

export const RepoMetaCard: FC<RepoMetaCardProps> = ({ meta }) => (
  <div className={`glass-card ${styles.card}`}>
    <div className={styles.header}>
      <div className={styles.title}>
        <GithubIcon size={18} />
        <span>{meta.fullName}</span>
      </div>
      <div className={styles.badges}>
        {meta.language && (
          <span className="badge badge-purple">
            <span className={styles.langDot} />
            {meta.language}
          </span>
        )}
        {meta.license && <span className="badge badge-blue">{meta.license}</span>}
      </div>
    </div>

    {meta.description && <p className={styles.desc}>{meta.description}</p>}

    <div className={styles.stats}>
      <span className={styles.stat}>⭐ {meta.stars.toLocaleString()}</span>
      <span className={styles.stat}>🍴 {meta.forks.toLocaleString()}</span>
      <span className={styles.stat}>🐛 {meta.openIssues.toLocaleString()} issues</span>
      {meta.topics.length > 0 && (
        <div className={styles.topics}>
          {meta.topics.slice(0, 5).map((t) => (
            <span key={t} className="badge badge-green" style={{ fontSize: '11px' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);

import type { FC } from 'react';
import type { Language, QuotaLimits } from '../types';
import styles from './Header.module.css';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  quota?: QuotaLimits | null;
}

export const Header: FC<HeaderProps> = ({ lang, onLangChange, quota }) => (
  <header className={styles.header}>
    <div className={styles.logo}>
      <span className={styles.logoText}>
        Code<span className="gradient-text">Copilot</span>
      </span>
    </div>
    <div className={styles.rightContainer}>
      {quota && (
        <div className={styles.quotaBadges}>
          <span className="badge badge-purple" title="Số lượt phân tích Repo còn lại trong 15 phút">
            ⚡ {quota.analyze.remaining}/{quota.analyze.limit} {lang === 'vi' ? 'Lượt phân tích' : 'Analyzes'}
          </span>
          <span className="badge badge-blue" title="Số lượt chat RAG còn lại trong 15 phút">
            💬 {quota.chat.remaining}/{quota.chat.limit} {lang === 'vi' ? 'Lượt chat' : 'Chats'}
          </span>
        </div>
      )}
      <div className={styles.langSelector}>
        <button
          className={`${styles.langBtn} ${lang === 'en' ? styles.langBtnActive : ''}`}
          onClick={() => onLangChange('en')}
        >
          EN
        </button>
        <button
          className={`${styles.langBtn} ${lang === 'vi' ? styles.langBtnActive : ''}`}
          onClick={() => onLangChange('vi')}
        >
          VI
        </button>
      </div>
      <div className={styles.badge}>
        <span className="pulse-dot" />
        <span>{lang === 'vi' ? 'Hỗ trợ bởi GPT' : 'Powered by GPT'}</span>
      </div>
    </div>
  </header>
);

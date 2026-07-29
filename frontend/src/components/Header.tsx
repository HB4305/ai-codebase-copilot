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
          <span
            className={styles.quotaPill}
            title={lang === 'vi' ? 'Số lượt phân tích còn lại trong 15 phút' : 'Remaining analyzes in 15 min'}
          >
            ⚡ {quota.analyze.remaining}/{quota.analyze.limit}
          </span>
          <span
            className={styles.quotaPill}
            title={lang === 'vi' ? 'Số lượt chat AI còn lại trong 15 phút' : 'Remaining chats in 15 min'}
          >
            💬 {quota.chat.remaining}/{quota.chat.limit}
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

import type { FC } from 'react';
import type { Language } from '../types';
import styles from './Header.module.css';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
}

export const Header: FC<HeaderProps> = ({ lang, onLangChange }) => (
  <header className={styles.header}>
    <div className={styles.logo}>
      <span className={styles.logoText}>
        Code<span className="gradient-text">Copilot</span>
      </span>
    </div>
    <div className={styles.rightContainer}>
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

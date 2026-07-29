import {
  type FC,
  type KeyboardEvent,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import type { ChatMessage, Language } from '../types';
import { markdownToHtml } from '../lib/markdown';
import { SpinnerIcon } from './Icons';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  loading: boolean;
  lang: Language;
}

const TRANSLATIONS = {
  en: {
    title: 'Ask about this repo',
    thinking: 'AI is thinking…',
    empty: 'Analysis complete! Ask me anything about this repository.',
    placeholder: 'Ask anything about this repository… (Enter to send)',
    suggestions: [
      'How do I install and run this project?',
      'What is the main architecture pattern?',
      'What are the key dependencies?',
    ],
  },
  vi: {
    title: 'Hỏi đáp về repo này',
    thinking: 'AI đang suy nghĩ…',
    empty: 'Đã hoàn tất phân tích! Hãy hỏi tôi bất cứ điều gì về repo này.',
    placeholder: 'Hỏi bất kỳ điều gì về repo này… (Enter để gửi)',
    suggestions: [
      'Làm thế nào để cài đặt và chạy dự án này?',
      'Mô hình kiến trúc chính của dự án là gì?',
      'Các thư viện phụ thuộc chính là gì?',
    ],
  },
};

export const ChatPanel: FC<ChatPanelProps> = ({ messages, onSend, loading, lang }) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang];

  // Auto-scroll when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || loading) return;
    setInput('');
    setSending(true);
    await onSend(trimmed);
    setSending(false);
  }, [input, sending, loading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const busy = sending || loading;

  return (
    <div className={`glass-card ${styles.panel}`}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <span>💬</span> {t.title}
        </span>
        {loading && (
          <span className={styles.status}>
            <SpinnerIcon className="spinner-purple" size={14} />
            {t.thinking}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🤖</span>
            <p>{t.empty}</p>
            <div className={styles.suggestions}>
              {t.suggestions.map((q) => (
                <button
                  key={q}
                  className={styles.suggestion}
                  onClick={() => setInput(q)}
                  disabled={busy}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${
                msg.role === 'user' ? styles.msgUser : styles.msgAI
              }`}
            >
              <div className={styles.avatar}>
                {msg.role === 'user' ? '👤' : '⚡'}
              </div>
              <div className={styles.bubble}>
                {msg.role === 'assistant' ? (
                  <>
                    <div
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                    />
                    {msg.sources && msg.sources.length > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          fontSize: '0.78rem',
                          color: '#94a3b8',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          paddingTop: '6px',
                        }}
                      >
                        📎 Sources: {msg.sources.map((s, idx) => (
                          <span key={idx} style={{ marginRight: '6px', fontFamily: 'monospace' }}>
                            {s.filePath}:{s.startLine}–{s.endLine}{idx < msg.sources!.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.streaming && <span className={styles.cursor} aria-hidden="true" />}
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className={styles.inputRow}>
        <textarea
          id="chat-input"
          className={styles.textarea}
          placeholder={t.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          rows={1}
        />
        <button
          id="chat-send-btn"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={busy || !input.trim()}
          aria-label="Send message"
        >
          {sending ? (
            <SpinnerIcon size={16} />
          ) : (
            <span>↑</span>
          )}
        </button>
      </div>
    </div>
  );
};

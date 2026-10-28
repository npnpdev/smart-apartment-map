import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ChatWidget.module.css';
import { useAppContext } from '../../context/AppContext';

interface ChatWidgetProps {
  // pytanie do wysłania od razu po otwarciu mapy (np. z wyszukiwarki na stronie głównej)
  initialMessage?: string | null;
}

const QUICK_TOPICS = [
  'Szukam cicho i bezpiecznie',
  'Mieszkanie dla rodziny z dziećmi',
  'Blisko szkół i przedszkoli',
  'Co mogę tu znaleźć?',
];

export default function ChatWidget({ initialMessage }: ChatWidgetProps) {
  const {
    chatMessages: messages,
    chatLoading: loading,
    sendChatMessage,
  } = useAppContext();
  const [open, setOpen] = useState(Boolean(initialMessage));
  const initialSent = useRef(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    sendChatMessage(text);
  };

  useEffect(() => {
    // ref chroni przed podwójnym wysłaniem (StrictMode uruchamia efekty dwa razy)
    if (!initialMessage || initialSent.current) return;
    initialSent.current = true;
    sendMessage(initialMessage);
    // tylko przy pierwszym initialMessage; sendMessage zmienia się co render, a ref i tak blokuje ponowne wysłanie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  return (
    <>
      {!open && (
        <button
          className={styles.fab}
          onClick={() => setOpen(true)}
          title="Asystent wyszukiwania"
        >
          💬
        </button>
      )}

      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Asystent wyszukiwania</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.body}>
            {messages.length === 0 && (
              <>
                <p className={styles.intro}>
                  Opisz czego szukasz, a zaktualizuję filtry na mapie. Możesz
                  też wybrać temat:
                </p>
                {QUICK_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    className={styles.topic}
                    onClick={() => sendMessage(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}
              >
                {m.role === 'assistant' ? (
                  // odpowiedzi modelu są w Markdownie (**pogrubienie**, listy)
                  <ReactMarkdown
                    components={{
                      a: (props) => (
                        <a {...props} target="_blank" rel="noreferrer" />
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            ))}

            {loading && (
              <div
                className={`${styles.msg} ${styles.msgBot} ${styles.loading}`}
              >
                <span />
                <span />
                <span />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className={styles.inputBar}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Wpisz czego szukasz…"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

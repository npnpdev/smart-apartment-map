import { useState, useRef, useEffect } from 'react';
import styles from './ChatWidget.module.css';

interface ChatFilters {
  safety_threshold?: number;
  noise_threshold?: number;
  edu_types?: string[];
  edu_radius?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  onFiltersReceived: (filters: ChatFilters) => void;
}

const QUICK_TOPICS = [
  'Szukam cicho i bezpiecznie',
  'Mieszkanie dla rodziny z dziećmi',
  'Blisko szkół i przedszkoli',
  'Co mogę tu znaleźć?',
];

export default function ChatWidget({ onFiltersReceived }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('http://localhost:8000/api/chatbot/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const data = await res.json();

      if (data.filters) {
        onFiltersReceived(data.filters);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Wystąpił błąd połączenia. Spróbuj ponownie.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button className={styles.fab} onClick={() => setOpen(true)} title="Asystent wyszukiwania">
          💬
        </button>
      )}

      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Asystent wyszukiwania</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.body}>
            {messages.length === 0 && (
              <>
                <p className={styles.intro}>
                  Opisz czego szukasz, a zaktualizuję filtry na mapie. Możesz też wybrać temat:
                </p>
                {QUICK_TOPICS.map(topic => (
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
              <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}>
                {m.content}
              </div>
            ))}

            {loading && (
              <div className={`${styles.msg} ${styles.msgBot} ${styles.loading}`}>
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
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Wpisz czego szukasz…"
              disabled={loading}
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

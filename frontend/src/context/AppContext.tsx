import { createContext, useCallback, useContext, useState, useEffect } from 'react';

type FontSize = "normal" | "large" | "xlarge";

type City = {
  name: string;
  center: [number, number];
};

export type ChatFilters = {
  safety_threshold?: number;
  noise_threshold?: number;
  edu_types?: string[];
  edu_radius?: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AppContextType = {
  email: string | null;
  setEmail: (login: string | null) => void;
  cities: City[];
  currentCity: City;
  changeCity: (cityName: string) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  // --- chatbot ---
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  // suma filtrów ustawionych przez chat; mapa stosuje je ponownie po powrocie na nią
  chatFilters: ChatFilters | null;
  sendChatMessage: (text: string) => Promise<void>;
  clearChat: () => void;
};

const FONT_SIZES: Record<FontSize, string> = {
  normal: "16px",
  large:  "20px",
  xlarge: "24px",
};

const CHAT_API_URL = 'http://localhost:8000/api/chatbot/chat/';
const CHAT_MESSAGES_KEY = 'chat.messages';
const CHAT_FILTERS_KEY = 'chat.filters';

// sessionStorage: rozmowa przetrwa przejścia między stronami i odświeżenie,
// znika po zamknięciu karty
function loadSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveSession(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // brak dostępu do storage (np. tryb prywatny) - rozmowa działa tylko w pamięci
  }
}

const cities: City[] = [
  { name: 'Gdańsk', center: [54.352,   18.6466] },
  { name: 'Gdynia', center: [54.5189,  18.5305] },
  { name: 'Sopot',  center: [54.4418,  18.5601] },
];

const AppContext = createContext<AppContextType>({
  email: null,
  setEmail: () => {},
  cities: [],
  currentCity: cities[0],
  changeCity: () => {},
  fontSize: "normal",
  setFontSize: () => {},
  chatMessages: [],
  chatLoading: false,
  chatFilters: null,
  sendChatMessage: async () => {},
  clearChat: () => {},
});

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<City>(cities[0]);
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem("fontSize") as FontSize) || "normal"
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", FONT_SIZES[fontSize]);
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  const changeCity = (cityName: string) => {
    const newCity = cities.find(city => city.name === cityName);
    if (newCity) setCurrentCity(newCity);
  };

  // --- CHATBOT ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    () => loadSession(CHAT_MESSAGES_KEY, [])
  );
  const [chatFilters, setChatFilters] = useState<ChatFilters | null>(
    () => loadSession(CHAT_FILTERS_KEY, null)
  );
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => saveSession(CHAT_MESSAGES_KEY, chatMessages), [chatMessages]);
  useEffect(() => saveSession(CHAT_FILTERS_KEY, chatFilters), [chatFilters]);

  const sendChatMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatLoading) return;

    const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
    setChatMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setChatLoading(true);

    try {
      const res = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();

      if (data.filters) {
        setChatFilters(prev => ({ ...prev, ...data.filters }));
      }

      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply ?? data.error ?? 'Wystąpił błąd. Spróbuj ponownie.' },
      ]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Wystąpił błąd połączenia. Spróbuj ponownie.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, chatLoading]);

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatFilters(null);
  }, []);

  return (
    <AppContext.Provider value={{
      email, setEmail,
      cities, currentCity, changeCity,
      fontSize, setFontSize,
      chatMessages, chatLoading, chatFilters, sendChatMessage, clearChat,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppContextProvider');
  return context;
}

export default AppContextProvider;
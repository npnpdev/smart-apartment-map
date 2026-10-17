import { createContext, useContext, useState, useEffect } from 'react';

type FontSize = "normal" | "large" | "xlarge";

type City = {
  name: string;
  center: [number, number];
};

export type FavoriteItem = {
  id: number;
  name: string;
  district: string | null;
  price: number;
  noise_db?: string;
};

type AppContextType = {
  email: string | null;
  setEmail: (login: string | null) => void;
  cities: City[];
  currentCity: City;
  changeCity: (cityName: string) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  favorites: Map<number, FavoriteItem>;
  toggleFavorite: (item: FavoriteItem) => void;
  isFavorite: (id: number) => boolean;
};

const FONT_SIZES: Record<FontSize, string> = {
  normal: "16px",
  large:  "20px",
  xlarge: "24px",
};

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
  favorites: new Map(),
  toggleFavorite: () => {},
  isFavorite: () => false,
});

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmailRaw] = useState<string | null>(
    () => localStorage.getItem("userEmail")
  );
  const [currentCity, setCurrentCity] = useState<City>(cities[0]);
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem("fontSize") as FontSize) || "normal"
  );
  const [favorites, setFavorites] = useState<Map<number, FavoriteItem>>(() => {
    const saved = localStorage.getItem("userEmail");
    if (!saved) return new Map();
    try {
      const stored = localStorage.getItem(`favorites_${saved}`);
      const items: FavoriteItem[] = stored ? JSON.parse(stored) : [];
      return new Map(items.map(item => [item.id, item]));
    } catch { return new Map(); }
  });

  const setEmail = (newEmail: string | null) => {
    if (newEmail) {
      localStorage.setItem("userEmail", newEmail);
      try {
        const stored = localStorage.getItem(`favorites_${newEmail}`);
        const items: FavoriteItem[] = stored ? JSON.parse(stored) : [];
        setFavorites(new Map(items.map(item => [item.id, item])));
      } catch { setFavorites(new Map()); }
    } else {
      localStorage.removeItem("userEmail");
      setFavorites(new Map());
    }
    setEmailRaw(newEmail);
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", FONT_SIZES[fontSize]);
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  const changeCity = (cityName: string) => {
    const newCity = cities.find(city => city.name === cityName);
    if (newCity) setCurrentCity(newCity);
  };

  const toggleFavorite = (item: FavoriteItem) => {
    if (!email) return;
    setFavorites(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      try {
        localStorage.setItem(`favorites_${email}`, JSON.stringify([...next.values()]));
      } catch {}
      return next;
    });
  };

  const isFavorite = (id: number) => favorites.has(id);

  return (
    <AppContext.Provider value={{
      email, setEmail,
      cities, currentCity, changeCity,
      fontSize, setFontSize,
      favorites, toggleFavorite, isFavorite,
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
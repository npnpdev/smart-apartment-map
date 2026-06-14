import { createContext, useContext, useState, useEffect } from 'react';

type FontSize = "normal" | "large" | "xlarge";

type City = {
  name: string;
  center: [number, number];
};

type AppContextType = {
  email: string | null;
  setEmail: (login: string | null) => void;
  cities: City[];
  currentCity: City;
  changeCity: (cityName: string) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
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

  return (
    <AppContext.Provider value={{
      email, setEmail,
      cities, currentCity, changeCity,
      fontSize, setFontSize,
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
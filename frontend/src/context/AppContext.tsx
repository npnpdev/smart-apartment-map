import { createContext, useContext, useState } from 'react';

type City = {
  name: string;
  center:[number, number];
};

type AppContextType = {
  email: string | null;
  setEmail: (login: string | null) => void;
  // --- NOWE RZECZY DLA MAPY ---
  cities: City[];
  currentCity: City;
  changeCity: (cityName: string) => void;
};

const cities: City[] = [
  { name: 'Gdańsk', center:[54.352, 18.6466] },
  { name: 'Gdynia', center:[54.5189, 18.5305] },
  { name: 'Sopot', center: [54.4418, 18.5601] },
];

const AppContext = createContext<AppContextType>({
  email: null,
  setEmail: () => {},
  // --- NOWE RZECZY DLA MAPY ---
  cities: [],
  currentCity: cities[0],
  changeCity: () => {},
});

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | null>(null);

  // --- NOWA LOGIKA STANU MAPY ---
  const [currentCity, setCurrentCity] = useState<City>(cities[0]);

  const changeCity = (cityName: string) => {
    const newCity = cities.find(city => city.name === cityName);
    if (newCity) {
      setCurrentCity(newCity);
    }
  };

  const appCtx = {
    email,
    setEmail,
    // --- UDOSTĘPNIAMY STAN MAPY CAŁEJ APLIKACJI ---
    cities,
    currentCity,
    changeCity,
  };

  return <AppContext.Provider value={appCtx}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context)
    throw new Error('useAppContext must be used within AppContextProvider');
  return context;
}

export default AppContextProvider;

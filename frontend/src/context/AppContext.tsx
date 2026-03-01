import { createContext, useContext, useState } from 'react';

type AppContextType = {
  email: string | null;
  setEmail: (login: string | null) => void;
};

const AppContext = createContext<AppContextType>({
  email: null,
  setEmail: () => {},
});

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | null>(null);

  const appCtx = {
    email,
    setEmail,
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

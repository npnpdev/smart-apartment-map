import { NavLink } from 'react-router-dom';
import classes from './MainNavigation.module.css';
import { useAppContext } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { path: "/", label: "Home", exact: true },
  { path: "/map", label: "Mapa" },
  { path: "/results", label: "Wyniki" },
];

export default function MainNavigation() {
  const { email, cities, currentCity, changeCity } = useAppContext();
  
  // Dark mode z pamięcią w localStorage
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  // Zamykanie dropdowna przy kliknięciu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Bezpieczniejsze sprawdzanie za pomocą contains
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    
    // Optymalizacja: nasłuchujemy tylko kiedy dropdown jest faktycznie otwarty
    if (isCityDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCityDropdownOpen]);

  // Zarządzanie klasą dark-theme i zapisem do localStorage
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
    
    // Funkcja sprzątająca, gdyby komponent przestał istnieć
    return () => {
      document.body.classList.remove('dark-theme');
    };
  }, [isDark]);

  return (
    <header className={classes.header}>
      <div className={classes.pill}>
        <nav>
          <ul className={classes.list}>
            
            {/* 1. Dynamicznie wygenerowane linki Główne */}
            {NAV_LINKS.map((link) => (
              <li key={link.path}>
                <NavLink 
                  to={link.path} 
                  end={link.exact}
                  className={({ isActive }) => isActive ? classes.active : undefined}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            
            <li><div className={classes.separator} /></li>

            {/* 3. Przełącznik Motywu */}
            <li>
              <button
                className={classes.themeToggle} 
                onClick={() => setIsDark((prev) => !prev)}
                aria-label={isDark ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                )}
              </button>
            </li>

            {/* 4. Sekcja Logowania */}
            {!email ? (
              <li>
                <NavLink to="/login" className={({ isActive }) => isActive ? classes.active : undefined}>
                  Zaloguj
                </NavLink>
              </li>
            ) : (
              <li className={classes.userItem}>
                <span className={classes.userEmail}>{email}</span>
                <NavLink to="/logout" className={({ isActive }) => isActive ? classes.active : undefined}>
                  Wyloguj
                </NavLink>
              </li>
            )}
            
          </ul>
        </nav>
      </div>
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import classes from './MainNavigation.module.css';
import { useAppContext } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { path: "/", label: "Home", exact: true },
  { path: "/map", label: "Mapa" },
  { path: "/most-liked", label: "Ulubione" },
];

export default function MainNavigation() {
  const { email, fontSize, setFontSize /*cities, currentCity, changeCity*/ } =
    useAppContext();
  
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
                  className={({ isActive }) =>
                    isActive ? classes.active : undefined
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}

            <li>
              <div className={classes.separator} />
            </li>

            <li ref={dropdownRef} className={classes.customDropdownContainer}>
              <button
                className={classes.dropdownTrigger}
                onClick={() => setIsCityDropdownOpen((p) => !p)}
                aria-expanded={isCityDropdownOpen}
                aria-label="Ustawienia"
              >
                Ustawienia
              </button>

              {isCityDropdownOpen && (
                <ul className={classes.dropdownMenu} style={{ minWidth: 180 }}>
                  {/* Ciemny motyw */}
                  <li>
                    <button
                      className={`${classes.dropdownItem} ${isDark ? classes.activeItem : ''}`}
                      onClick={() => setIsDark((p) => !p)}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        {isDark ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                          </svg>
                        )}
                        {isDark ? 'Tryb ciemny' : 'Tryb jasny'}
                      </span>
                    </button>
                  </li>

                  <li>
                    <div
                      style={{
                        height: 1,
                        background: 'var(--divider)',
                        margin: '4px 0',
                      }}
                    />
                  </li>

                  <li style={{ padding: '6px 14px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Rozmiar tekstu
                    </span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {(['normal', 'large', 'xlarge'] as const).map(
                        (size, i) => (
                          <button
                            key={size}
                            onClick={() => setFontSize(size)}
                            style={{
                              flex: 1,
                              padding: '6px 0',
                              background:
                                fontSize === size
                                  ? 'var(--accent)'
                                  : 'var(--glass-elevated)',
                              color:
                                fontSize === size
                                  ? 'var(--accent-contrast)'
                                  : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: `${13 + i * 4}px`,
                              fontWeight: fontSize === size ? 700 : 400,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            aria-pressed={fontSize === size}
                          >
                            A
                          </button>
                        )
                      )}
                    </div>
                  </li>
                </ul>
              )}
            </li>

            <li>
              <div className={classes.separator} />
            </li>

            {/* 4. Sekcja Logowania */}
            {!email ? (
              <li>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive ? classes.active : undefined
                  }
                >
                  Zaloguj
                </NavLink>
              </li>
            ) : (
              <li className={classes.userItem}>
                <span className={classes.userEmail}>{email}</span>
                <NavLink
                  to="/logout"
                  className={({ isActive }) =>
                    isActive ? classes.active : undefined
                  }
                >
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

import { NavLink, Link } from 'react-router-dom';
import classes from './MainNavigation.module.css';
import { useAppContext } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';
import { Heart, House, LogOut, Map as MapIcon, Moon, Settings, Sun, User, UserX } from 'lucide-react';
import { t } from '../../locales';

const NAV_LINKS = [
  { path: "/", label: t.nav.home, exact: true, icon: <House size={17} /> },
  { path: "/map", label: t.nav.map, icon: <MapIcon size={17} /> },
  { path: "/most-liked", label: t.nav.favorites, icon: <Heart size={17} /> },
];

export default function MainNavigation() {
  const { email, fontSize, setFontSize } = useAppContext();

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
                  <span className={classes.navLabelFull}>{link.label}</span>
                  <span className={classes.navLabelIcon} aria-label={link.label} data-label={link.label}>{link.icon}</span>
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
                aria-label={t.nav.settings}
              >
                <span className={classes.navLabelFull}>{t.nav.settings}</span>
                <span className={classes.navLabelIcon} data-label={t.nav.settings}><Settings size={17} /></span>
              </button>

              {isCityDropdownOpen && (
                <ul className={classes.dropdownMenu}>
                  {/* Ciemny motyw */}
                  <li>
                    <button
                      className={`${classes.dropdownItem} ${isDark ? classes.activeItem : ''}`}
                      onClick={() => setIsDark((p) => !p)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isDark ? <Moon size={15} /> : <Sun size={15} />}
                        {isDark ? t.nav.darkMode : t.nav.lightMode}
                      </span>
                    </button>
                  </li>

                  <li>
                    <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
                  </li>

                  <li style={{ padding: '6px 14px' }} className={classes.fontSizeSection}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {t.nav.textSize}
                    </span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {(['normal', 'large', 'xlarge'] as const).map((size, i) => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size)}
                          className={size === 'xlarge' ? classes.fontSizeXlarge : undefined}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            background: fontSize === size ? 'var(--accent)' : 'var(--glass-elevated)',
                            color: fontSize === size ? 'var(--accent-contrast)' : 'var(--text-secondary)',
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
                      ))}
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
                  className={({ isActive }) => isActive ? classes.active : undefined}
                >
                  <span className={classes.navLabelFull}>{t.nav.login}</span>
                  <span className={classes.navLabelIcon} aria-label={t.nav.login} data-label={t.nav.login}><User size={17} /></span>
                </NavLink>
              </li>
            ) : (
              <li className={classes.userItem}>
                <span className={classes.userEmail}>{email}</span>
                <NavLink
                  to="/logout"
                  className={({ isActive }) => isActive ? classes.active : undefined}
                >
                  <span className={classes.navLabelFull}>{t.nav.logout}</span>
                  <span className={classes.navLabelIcon} aria-label={t.nav.logout} data-label={t.nav.logout}><LogOut size={17} /></span>
                </NavLink>
                <Link
                  to="/delete-account"
                  className={classes.deleteLink}
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <span className={classes.navLabelFull}>{t.nav.deleteAccount}</span>
                  <span className={classes.navLabelIcon} aria-label={t.nav.deleteAccount} data-label={t.nav.deleteAccount}><UserX size={17} /></span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

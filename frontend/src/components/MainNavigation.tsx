import { NavLink } from 'react-router-dom';
import classes from './MainNavigation.module.css';
import { useAppContext } from '../context/AppContext';
import { useState, useEffect } from 'react';

function MainNavigation() {
  const { email, cities, currentCity, changeCity } = useAppContext();
  
  // Prosty state dla dark mode (domyślnie light, żeby pasował do nowego UI)
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDark]);

  return (
    <header className={classes.header}>
      <div className={classes.pill}>
        <nav>
          <ul className={classes.list}>
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? classes.active : undefined} end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/map" className={({ isActive }) => isActive ? classes.active : undefined}>
                Mapa
              </NavLink>
            </li>
            <li>
              <NavLink to="/results" className={({ isActive }) => isActive ? classes.active : undefined}>
                Wyniki
              </NavLink>
            </li>
            
            <li><div className={classes.separator} /></li>

            {/* Wybór miasta */}
            {/* Wybór miasta */}
            <li>
              <div className={classes.citySelectWrapper}>
                {/* Wyświetlamy tylko nazwę miasta, bez pinezki */}
                <span>{currentCity.name}</span>
                
                <select 
                  className={classes.citySelect}
                  value={currentCity.name}
                  onChange={(e) => changeCity(e.target.value)}
                >
                  {cities.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
            </li>

            <li><div className={classes.separator} /></li>

            {/* Przycisk zmiany motywu */}
            <li>
              <button
                className={classes.themeToggle} 
                onClick={() => setIsDark(!isDark)}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                  </svg>
                )}
              </button>
            </li>

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

export default MainNavigation;

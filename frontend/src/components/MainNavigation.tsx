import { NavLink } from "react-router-dom";
import classes from "./MainNavigation.module.css";

function MainNavigation() {
  return (
    <header className={classes.header}>
      <nav>
        <ul className={classes.list}>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? classes.active : undefined
              }
              end
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/map"
              className={({ isActive }) =>
                isActive ? classes.active : undefined
              }
            >
              Mapa
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/results"
              className={({ isActive }) =>
                isActive ? classes.active : undefined
              }
            >
              Wyniki
            </NavLink>
          </li>
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
        </ul>
      </nav>
    </header>
  );
}

export default MainNavigation;

import SidePanel from "../SidePanel/SidePanel.tsx";
import styles from "./LeftSidePanel.module.css";
import { useState } from "react";

export default function LeftSidePanel() {
  const [loggedIn, setLoggedIn] = useState(false);

  function handleLoginClick(): void {
    setLoggedIn((prev) => !prev);
  }

  return (
    <SidePanel side="left" title="Logowanie" width={400}>
      <div className={styles.loginContainer}>
        {!loggedIn && (
          <>
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className={styles.loginInput}
                type="text"
                placeholder="twoj@email.com"
              />
            </div>
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="password">
                Hasło
              </label>
              <input
                id="password"
                className={styles.loginInput}
                type="password"
                placeholder="••••••••"
              />
            </div>
          </>
        )}
        <button
          type="button"
          className={styles.loginButton}
          onClick={handleLoginClick}
        >
          {loggedIn ? "Wyloguj" : "Zaloguj"}
        </button>
      </div>
    </SidePanel>
  );
}

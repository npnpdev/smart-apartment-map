import { useState } from "react";
import styles from "./SidePanel.module.css";

export default function SidePanel({
  side = "right",     // "right" albo "left"
  width = 380,        // px
  title = "",
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const cls = [
    styles.panel,
    side === "left" ? styles.left : styles.right,
    collapsed ? styles.collapsed : "",
  ].join(" ");

  return (
    <aside className={cls} style={{ width }} aria-expanded={!collapsed}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setCollapsed(v => !v)}
        aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
        title={collapsed ? "Rozwiń" : "Zwiń"}
      >
        {/* proste strzałki bez ikon */}
        <span className={styles.chevron}>
          {side === "right" ? (collapsed ? "◀" : "▶") : (collapsed ? "▶" : "◀")}
        </span>
      </button>

      <header className={styles.header}>
        <div className={styles.title}>{title}</div>
      </header>

      <div className={styles.content}>{children}</div>
    </aside>
  );
}

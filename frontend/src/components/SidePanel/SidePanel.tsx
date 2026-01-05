import { ReactNode, useState } from "react";
import styles from "./SidePanel.module.css";

type Side = "left" | "right";

export default function SidePanel({
  side = "right",
  width = 520,
  collapsedWidth = 56,
  title,
  subtitle,
  children,
}: {
  side?: Side;
  width?: number;
  collapsedWidth?: number;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const cls = [
    styles.panel,
    side === "left" ? styles.left : styles.right,
    collapsed ? styles.collapsed : "",
  ].join(" ");

  return (
    <aside
      className={cls}
      style={
        {
          ["--panel-width" as any]: `${width}px`,
          ["--collapsed-width" as any]: `${collapsedWidth}px`,
        } as any
      }
      aria-expanded={!collapsed}
    >
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
        title={collapsed ? "Rozwiń" : "Zwiń"}
      >
        <span className={styles.chevron}>
          {side === "right" ? (collapsed ? "◀" : "▶") : collapsed ? "▶" : "◀"}
        </span>
      </button>

      <div className={styles.inner}>
        {(subtitle || title) && (
          <header className={styles.header}>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
            {title && <div className={styles.title}>{title}</div>}
            <div className={styles.divider} />
          </header>
        )}

        <div className={styles.content}>{children}</div>
      </div>
    </aside>
  );
}

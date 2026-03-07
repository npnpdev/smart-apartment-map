import { type ReactNode, useState, useEffect } from "react";
import styles from "./SidePanel.module.css";

type Side = "left" | "right";

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      className={styles.chevronIcon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {direction === "up" ? (
        <path
          d="M6 14L12 8L18 14"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M6 10L12 16L18 10"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function SidePanel({
  side = "right",
  width = 520,
  title,
  subtitle,
  children,
}: {
  side?: Side;
  width?: number;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  // 1. Tworzymy unikalny klucz dla localStorage
  const storageKey = `sidepanel_collapsed_${side}_${title || "default"}`;

  // 2. Inicjalizujemy stan czytając z localStorage
  const[collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem(storageKey);
    // Jeśli jest coś w pamięci to używamy tego, w przeciwnym razie domyślnie false
    return savedState !== null ? JSON.parse(savedState) : false;
  });

  // 3. Nasłuchujemy zmian - jak tylko `collapsed` się zmieni, zapisujemy do pamięci
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  const panelClassName =[
    styles.panel,
    side === "left" ? styles.left : styles.right,
    collapsed ? styles.panelHidden : "",
  ].join(" ");

  const floatingButtonClassName =[
    styles.floatingToggle,
    side === "left" ? styles.floatingToggleLeft : styles.floatingToggleRight,
    collapsed ? styles.floatingToggleVisible : "",
  ].join(" ");

  return (
    <>
      <aside
        className={panelClassName}
        style={
          {
            ["--panel-width" as any]: `${width}px`,
          } as any
        }
        aria-expanded={!collapsed}
      >
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed(true)}
          aria-label="Zwiń panel"
          title="Zwiń"
        >
          <ChevronIcon direction="up" />
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

      <button
        type="button"
        className={floatingButtonClassName}
        onClick={() => setCollapsed(false)}
        aria-label="Rozwiń panel"
        title="Rozwiń"
      >
        <ChevronIcon direction="down" />
      </button>
    </>
  );
}
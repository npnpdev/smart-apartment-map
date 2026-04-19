import { type ReactNode, useState, useEffect } from 'react';
import styles from './SidePanel.module.css';

type Side = 'left' | 'right';

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      className={styles.chevronIcon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <path
          d="M15 18L9 12L15 6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9 18L15 12L9 6"
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
  side = 'right',
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
  const storageKey = `sidepanel_collapsed_${side}_${title || 'default'}`;

  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem(storageKey);
    return savedState !== null ? JSON.parse(savedState) : false;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  const panelClassName = [
    styles.panel,
    side === 'left' ? styles.left : styles.right,
    collapsed ? styles.panelHidden : '',
  ].join(' ');

  // Ikona: panel prawy — gdy otwarty pokaż >, gdy zwinięty pokaż
  // Panel lewy — odwrotnie
  const iconDirection =
    side === 'right'
      ? collapsed
        ? 'left'
        : 'right'
      : collapsed
        ? 'right'
        : 'left';

  return (
    <>
      <aside
        className={panelClassName}
        style={{ ['--panel-width' as any]: `${width}px` } as any}
        aria-expanded={!collapsed}
      >
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

      {/* Przycisk zawsze widoczny, przyklejony do krawędzi */}
      <button
        type="button"
        className={[
          styles.edgeToggle,
          side === 'right' ? styles.edgeToggleRight : styles.edgeToggleLeft,
        ].join(' ')}
        onClick={() => setCollapsed((prev: boolean) => !prev)}
        aria-label={collapsed ? 'Rozwiń panel' : 'Zwiń panel'}
      >
        <ChevronIcon direction={iconDirection} />
      </button>
    </>
  );
}

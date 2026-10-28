import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
  useState,
  useEffect,
  useRef,
} from 'react';
import styles from './SidePanel.module.css';

type Side = 'left' | 'right';

// Ruch palca/myszy poniżej tego progu to kliknięcie, a nie przeciąganie
const DRAG_THRESHOLD_PX = 6;

type DragState = {
  startX: number;
  startShift: number;
  width: number;
  moved: boolean;
};

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
  toolbar,
  footer,
  openSignal,
  children,
}: {
  side?: Side;
  width?: number;
  title?: string;
  subtitle?: string;
  // stały pasek nad przewijaną treścią (np. przycisk "Filtry" / "Pokaż oferty")
  toolbar?: ReactNode;
  // stała stopka pod przewijaną treścią (np. paginacja)
  footer?: ReactNode;
  // zmiana na wartość różną od null wysuwa zwinięty panel (np. wybór mieszkania na mapie)
  openSignal?: unknown;
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

  const [lastOpenSignal, setLastOpenSignal] = useState(openSignal);
  if (openSignal !== lastOpenSignal) {
    setLastOpenSignal(openSignal);
    if (openSignal !== null && openSignal !== undefined) setCollapsed(false);
  }

  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  // o ile px panel jest schowany podczas przeciągania (0 = otwarty, width = zamknięty)
  const [dragShift, setDragShift] = useState<number | null>(null);
  // dla prawego panelu ruch w prawo chowa panel, dla lewego - w lewo
  const closeDirection = side === 'right' ? 1 : -1;

  const clampShift = (value: number, width: number) =>
    Math.min(width, Math.max(0, value));

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !panelRef.current) return;
    const width = panelRef.current.offsetWidth;
    drag.current = {
      startX: event.clientX,
      startShift: collapsed ? width : 0,
      width,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.startX) * closeDirection;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    setDragShift(clampShift(d.startShift + dx, d.width));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return; // zwykłe kliknięcie obsłuży onClick

    suppressClick.current = true;
    const shift = clampShift(
      d.startShift + (event.clientX - d.startX) * closeDirection,
      d.width
    );
    // dociąganie: schowany w ponad połowie -> zamknij, w mniej niż połowie -> otwórz
    setCollapsed(shift > d.width / 2);
    setDragShift(null);
  };

  const handlePointerCancel = () => {
    drag.current = null;
    setDragShift(null);
  };

  const handleClick = () => {
    // po przeciągnięciu przeglądarka i tak wysyła click - ignorujemy go
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setCollapsed((prev: boolean) => !prev);
  };

  const isDragging = dragShift !== null;

  const panelClassName = [
    styles.panel,
    side === 'left' ? styles.left : styles.right,
    collapsed && !isDragging ? styles.panelHidden : '',
    isDragging ? styles.dragging : '',
  ].join(' ');

  const panelStyle: CSSProperties & { '--panel-width': string } = {
    '--panel-width': `${width}px`,
    ...(isDragging && {
      transform: `translateX(${dragShift * closeDirection}px)`,
    }),
  };

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
        ref={panelRef}
        className={panelClassName}
        style={panelStyle}
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
          {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
          <div
            className={[
              styles.content,
              subtitle || title || toolbar ? '' : styles.contentNoHeader,
            ].join(' ')}
          >
            {children}
          </div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>

        {/* Uchwyt przy krawędzi panelu: kliknięcie zwija/rozwija, przeciągnięcie wsuwa/wysuwa */}
        <button
          type="button"
          className={[
            styles.edgeToggle,
            side === 'right' ? styles.edgeToggleRight : styles.edgeToggleLeft,
          ].join(' ')}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          aria-label={collapsed ? 'Rozwiń panel' : 'Zwiń panel'}
        >
          <ChevronIcon direction={iconDirection} />
        </button>
      </aside>
    </>
  );
}

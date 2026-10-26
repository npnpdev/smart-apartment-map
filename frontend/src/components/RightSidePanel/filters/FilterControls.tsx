import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import s from './Filters.module.css';
import type { ChipOption, Range, RangeLimits } from './apartmentFilters';

// Zatrzymuje zdarzenia, żeby przeciąganie suwaka nie przesuwało mapy pod panelem
const stopMapDrag = {
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

/* ---------- Zwijana sekcja filtrów ---------- */

export function FilterGroup({
  id,
  title,
  activeCount = 0,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  activeCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const storageKey = `filters_group_${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === '1';
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      // brak dostępu do localStorage - stan zwinięcia nie zostanie zapamiętany
    }
  }, [open, storageKey]);

  return (
    <section className={s.group}>
      <button
        type="button"
        className={s.groupHeader}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={s.groupTitle}>{title}</span>
        {activeCount > 0 && <span className={s.groupBadge}>{activeCount}</span>}
        <ChevronDown
          size={18}
          className={`${s.groupChevron} ${open ? s.groupChevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className={s.groupBody}>{children}</div>}
    </section>
  );
}

/* ---------- Pojedyncze pole z etykietą ---------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <div className={s.fieldLabel}>{label}</div>
      {children}
      {hint && <p className={s.fieldHint}>{hint}</p>}
    </div>
  );
}

/* ---------- Przyciski wielokrotnego wyboru ---------- */

export function ChipGroup({
  options,
  selected,
  onChange,
  ariaLabel,
}: {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
}) {
  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );

  return (
    <div className={s.chips} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`${s.chip} ${active ? s.chipActive : ''}`}
            aria-pressed={active}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Przełącznik ---------- */

export function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={s.toggleRow}>
      <span className={s.fieldLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`${s.toggle} ${checked ? s.toggleOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={s.toggleKnob} />
      </button>
    </div>
  );
}

/* ---------- Suwak "od-do" (dwa nałożone suwaki) + pola liczbowe ---------- */

function NumberBox({
  value,
  bound,
  placeholder,
  normalize,
  onCommit,
}: {
  value: number;
  bound: number;
  placeholder: string;
  // przycina wpisaną liczbę do dozwolonego zakresu
  normalize: (value: number) => number;
  onCommit: (value: number) => void;
}) {
  // wartość graniczna = brak limitu, więc pole jest puste i pokazuje placeholder.
  // Gdy wartość zmieni się z zewnątrz (suwak), RangeFilter montuje pole od nowa (key).
  const display = (v: number) => (v === bound ? '' : String(v));
  const [draft, setDraft] = useState(display(value));

  const commit = () => {
    const next = draft === '' ? bound : normalize(Number(draft));
    // pole zawsze pokazuje wartość, której faktycznie używa filtr
    // (np. wpisane -600 wraca do pustego "od", 50 w polu "do" do minimum)
    setDraft(display(next));
    onCommit(next);
  };

  return (
    <input
      className={s.numberBox}
      inputMode="numeric"
      value={draft}
      placeholder={placeholder}
      // tylko cyfry - bez minusa, liter i spacji
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export function RangeFilter({
  value,
  onChange,
  limits,
  unit,
}: {
  value: Range;
  onChange: (next: Range) => void;
  limits: RangeLimits;
  unit: string;
}) {
  const { min, max, step } = limits;
  const [low, high] = value;
  const percent = (v: number) => ((v - min) / (max - min)) * 100;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

  // dolny uchwyt dociągnięty do prawej musi być na wierzchu, inaczej nie da się go złapać
  const lowOnTop = low > max - (max - min) * 0.1;

  return (
    <div className={s.range}>
      <div className={s.rangeSliders}>
        <div className={s.rangeTrack}>
          <div
            className={s.rangeFill}
            style={{
              left: `${percent(low)}%`,
              right: `${100 - percent(high)}%`,
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label="Wartość minimalna"
          className={s.rangeInput}
          style={{ zIndex: lowOnTop ? 4 : 3 }}
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), high - step), high])
          }
          {...stopMapDrag}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label="Wartość maksymalna"
          className={s.rangeInput}
          onChange={(e) =>
            onChange([low, Math.max(Number(e.target.value), low + step)])
          }
          {...stopMapDrag}
        />
      </div>

      <div className={s.rangeBoxes}>
        <NumberBox
          key={`low-${low}`}
          value={low}
          bound={min}
          placeholder="od"
          normalize={(v) => clamp(v, min, high - step)}
          onCommit={(v) => onChange([v, high])}
        />
        <span className={s.rangeDash}>–</span>
        <NumberBox
          key={`high-${high}`}
          value={high}
          bound={max}
          placeholder="bez limitu"
          normalize={(v) => clamp(v, low + step, max)}
          onCommit={(v) => onChange([low, v])}
        />
        <span className={s.rangeUnit}>{unit}</span>
      </div>
    </div>
  );
}

/* ---------- Pojedynczy suwak (ten sam wygląd co suwak "od-do") ---------- */

export function SliderFilter({
  value,
  onChange,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  valueLabel,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  valueLabel: ReactNode;
  disabled?: boolean;
}) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`${s.range} ${disabled ? s.rangeDisabled : ''}`}>
      <div className={s.rangeSliders}>
        <div className={s.rangeTrack}>
          <div
            className={s.rangeFill}
            style={{ left: 0, right: `${100 - percent}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={typeof valueLabel === 'string' ? valueLabel : undefined}
          className={`${s.rangeInput} ${s.singleInput}`}
          onChange={(e) => onChange(Number(e.target.value))}
          {...stopMapDrag}
        />
      </div>
      <div className={s.sliderMeta}>
        <span>{minLabel}</span>
        <strong className={s.sliderValue}>{valueLabel}</strong>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

/* ---------- Wybór dzielnic: wyszukiwarka z podpowiedziami + "pigułki" ---------- */

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function DistrictPicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = options
    .filter(
      (o) => !selected.includes(o) && normalize(o).includes(normalize(query))
    )
    .slice(0, 8);

  const add = (district: string) => {
    onChange([...selected, district]);
    setQuery('');
  };

  return (
    <div className={s.picker}>
      <div className={s.searchBox}>
        <Search size={16} className={s.searchIcon} aria-hidden="true" />
        <input
          className={s.searchInput}
          value={query}
          placeholder="Szukaj dzielnicy, np. Oliwa"
          aria-label="Szukaj dzielnicy"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) add(suggestions[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className={s.suggestions} role="listbox">
          {suggestions.map((district) => (
            <li key={district}>
              <button
                type="button"
                className={s.suggestion}
                // mousedown zamiast click: inaczej blur inputa zamknie listę przed kliknięciem
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(district);
                }}
              >
                {district}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className={s.pills}>
          {selected.map((district) => (
            <span key={district} className={s.pill}>
              {district}
              <button
                type="button"
                className={s.pillRemove}
                aria-label={`Usuń ${district}`}
                onClick={() => onChange(selected.filter((d) => d !== district))}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Rozwijane "Więcej" wewnątrz sekcji ---------- */

export function MoreToggle({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.more}>
      <button
        type="button"
        className={s.moreButton}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown
          size={16}
          className={`${s.groupChevron} ${open ? s.groupChevronOpen : ''}`}
          aria-hidden="true"
        />
        {label}
      </button>
      {open && <div className={s.moreBody}>{children}</div>}
    </div>
  );
}

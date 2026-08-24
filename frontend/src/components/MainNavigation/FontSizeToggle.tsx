import { useAppContext } from '../../context/AppContext.tsx';

const OPTIONS = [
  { size: 'normal', label: 'A', fontSize: '13px' },
  { size: 'large', label: 'A', fontSize: '17px' },
  { size: 'xlarge', label: 'A', fontSize: '21px' },
] as const;

export default function FontSizeToggle() {
  const { fontSize, setFontSize } = useAppContext();

  return (
    <div style={styles.wrapper} aria-label="Rozmiar czcionki">
      {OPTIONS.map(({ size, label, fontSize: fs }) => (
        <button
          key={size}
          onClick={() => setFontSize(size)}
          style={{
            ...styles.btn,
            fontSize: fs,
            borderColor:
              fontSize === size ? '#E94080' : 'rgba(255,255,255,0.2)',
            color: fontSize === size ? '#E94080' : 'rgba(255,255,255,0.6)',
            fontWeight: fontSize === size ? 700 : 400,
          }}
          aria-pressed={fontSize === size}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  btn: {
    background: 'transparent',
    border: '1px solid',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    lineHeight: 1,
  },
};

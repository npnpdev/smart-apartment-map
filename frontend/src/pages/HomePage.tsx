import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AudioWaveform,
  GraduationCap,
  Layers,
  MapPinned,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import classes from './HomePage.module.css';

const FEATURES = [
  {
    icon: AudioWaveform,
    title: 'Hałas',
    text: 'Sprawdź poziom hałasu w otoczeniu mieszkania, zanim podejmiesz decyzję. Dzięki naszej mapie hałasu łatwo wybierzesz miejsce, w którym naprawdę się wyśpisz.',
  },
  {
    icon: GraduationCap,
    title: 'Edukacja',
    text: 'Sprawdź liczbę pobliskich przedszkoli, szkół podstawowych, liceów czy uczelni. Dzięki naszym filtrom bez problemu ocenisz dostęp do placówek edukacyjnych w okolicy twojego wymarzonego mieszkania.',
  },
  {
    icon: ShieldCheck,
    title: 'Bezpieczeństwo',
    text: 'Zweryfikuj wskaźnik bezpieczeństwa w dzielnicy, zanim kupisz lub wynajmiesz mieszkanie. Dzięki naszej platformie łatwo porównasz okolice i wybierzesz tę, w której poczujesz się bezpiecznie.',
  },
];

const STEPS = [
  {
    icon: Layers,
    title: 'Zbieramy dane',
    text: 'Agregujemy oferty z mieszkaniami oraz dodatkowe parametry.',
  },
  {
    icon: MapPinned,
    title: 'Strona z mapą',
    text: 'Prezentujemy zebrane dane w przystępnej wizualnie formie.',
  },
  {
    icon: Scale,
    title: 'Ty porównujesz',
    text: 'Zestawiaj lokalizacje, filtruj oferty i zapisuj najciekawsze z nich.',
  },
];

// Czas zapełniania całej linii; kropki zapalają się, gdy linia do nich dojdzie
const FILL_DURATION_S = 1.8;

function StepsTimeline() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  // start animacji, gdy oś pojawi się na ekranie (jednorazowo)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`${classes.steps} ${playing ? classes.stepsPlaying : ''}`}
      style={
        { '--fill-duration': `${FILL_DURATION_S}s` } as React.CSSProperties
      }
    >
      <div className={classes.stepsLine} aria-hidden="true">
        <div className={classes.stepsLineFill} />
      </div>
      <ol className={classes.stepList}>
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className={classes.step}
            style={
              {
                '--step-delay': `${(index / (STEPS.length - 1)) * FILL_DURATION_S}s`,
              } as React.CSSProperties
            }
          >
            <div className={classes.stepDot}>
              <step.icon size={20} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className={classes.stepBody}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/map?q=${encodeURIComponent(trimmed)}` : '/map');
  }

  return (
    <div className={classes.page}>
      <section className={classes.hero}>
        <div className={classes.heroContent}>
          <h1 className={classes.title}>Znajdź mieszkanie w Gdańsku</h1>
          <form className={classes.search} onSubmit={handleSubmit}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Opisz czego szukasz"
              aria-label="Szukaj mieszkania"
            />
            <button type="submit">Szukaj</button>
          </form>
        </div>
      </section>

      <div className={classes.content}>
        <section className={classes.section}>
          <h2>Jak to działa?</h2>
          <StepsTimeline />
        </section>

        <section className={classes.section}>
          <h2>Co oferujemy?</h2>
          <div className={classes.tiles}>
            {FEATURES.map((tile) => (
              <article key={tile.title} className={classes.tile}>
                <div className={classes.tileHeader}>
                  <div className={classes.tileIcon}>
                    <tile.icon size={20} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <h3>{tile.title}</h3>
                </div>
                <p>{tile.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className={classes.footer}>
        <span>Smart Apartment Map</span>
        <span>Gdańsk, {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

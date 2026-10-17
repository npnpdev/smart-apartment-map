import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import styles from './MostLiked.module.css';

export default function MostLikedPage() {
  const { email, favorites, toggleFavorite, isFavorite } = useAppContext();

  if (!email) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyHeart}>🔒</div>
          <h2 className={styles.emptyTitle}>Tylko dla zalogowanych</h2>
          <p className={styles.emptyDesc}>
            Zaloguj się lub załóż darmowe konto, aby zapisywać ulubione mieszkania i wracać do nich w dowolnym momencie.
          </p>
          <Link to="/login" className={styles.emptyBtn}>
            Zaloguj się / Zarejestruj
          </Link>
        </div>
      </div>
    );
  }

  if (favorites.size === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyHeart}>♡</div>
          <h2 className={styles.emptyTitle}>Brak polubionych mieszkań</h2>
          <p className={styles.emptyDesc}>
            Przeglądaj oferty na mapie i klikaj ♡ przy tych, które Ci się spodobają.
          </p>
          <Link to="/map" className={styles.emptyBtn}>
            Przejdź do mapy
          </Link>
        </div>
      </div>
    );
  }

  const apartments = [...favorites.values()];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Moje ulubione</h1>
        <span className={styles.count}>
          {apartments.length}{' '}
          {apartments.length === 1 ? 'oferta' : apartments.length < 5 ? 'oferty' : 'ofert'}
        </span>
      </div>

      <div className={styles.list}>
        {apartments.map((apt) => (
          <div key={apt.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardPrice}>
                {Number(apt.price).toLocaleString('pl-PL')} zł
              </span>
              {apt.district && (
                <span className={styles.cardDistrict}>
                  {apt.district.toUpperCase()}
                </span>
              )}
              <button
                className={`${styles.heartBtn} ${isFavorite(apt.id) ? styles.heartActive : ''}`}
                onClick={() => toggleFavorite(apt)}
                title="Usuń z ulubionych"
                aria-label="Usuń z ulubionych"
              >
                {isFavorite(apt.id) ? '♥' : '♡'}
              </button>
            </div>

            <div className={styles.cardTitle}>{apt.name}</div>

            <div className={styles.cardFooter}>
              <Link to={`/map?highlight=${apt.id}`} className={styles.cardMapBtn}>
                Pokaż na mapie
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

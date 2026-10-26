import { useNavigate } from 'react-router-dom';
import styles from './RightSidePanel.module.css';
import type { Building } from './RightSidePanel';
import { useAppContext } from '../../context/AppContext';

interface Props {
  building: Building;
  isHovered: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  eduTypes: string[];
  educationData: any[];
  getDistanceInKm: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number;
  eduRadius: number;
  // wskaźnik przestępstw na 1000 mieszkańców w dzielnicy mieszkania
  crimeRate?: number;
}

const MAX_FACILITIES = 3;

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('pl-PL', { maximumFractionDigits: digits });

// API zwraca Decimal jako string, a brak danych jako null
const toNumber = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : Number(value);

export function BuildingCard({
  building,
  isHovered,
  isExpanded,
  onToggleExpand,
  onMouseEnter,
  onMouseLeave,
  eduTypes,
  educationData,
  getDistanceInKm,
  eduRadius,
  crimeRate,
}: Props) {
  const { email, isFavorite, toggleFavorite } = useAppContext();
  const navigate = useNavigate();
  const liked = isFavorite(building.id);

  // Najbliższe placówki z wybranych w filtrze typów (bez modyfikowania educationData)
  const facilities =
    isExpanded && eduTypes.length > 0
      ? educationData
          .filter((facility: any) => eduTypes.includes(facility.education_type))
          .map((facility: any) => ({
            name: facility.name || facility.education_type,
            distanceKm: getDistanceInKm(
              building.lat,
              building.lng,
              facility.lat,
              facility.lng
            ),
          }))
          .filter((facility) => facility.distanceKm <= eduRadius)
          .sort((a, b) => a.distanceKm - b.distanceKm)
      : [];

  const area = toNumber(building.area);
  const pricePerM2 = toNumber(building.price_per_m2);
  const noise = toNumber(building.noise_db);

  // null = brak danych w ogłoszeniu, wyświetlane jako "—"
  const stats: { label: string; value: string | number | null }[] = [
    {
      label: 'Metraż',
      value: area !== null ? `${formatNumber(area, 1)} m²` : null,
    },
    { label: 'Pokoje', value: building.rooms ?? null },
    {
      label: 'Piętro',
      value: building.floor === 0 ? 'parter' : (building.floor ?? null),
    },
    { label: 'Rok budowy', value: building.year_built ?? null },
    {
      label: 'Winda',
      value:
        building.has_elevator == null
          ? null
          : building.has_elevator
            ? 'tak'
            : 'nie',
    },
    {
      label: 'Cena za m²',
      value: pricePerM2 !== null ? `${formatNumber(pricePerM2)} zł` : null,
    },
    { label: 'Hałas', value: noise !== null ? `${noise} dB` : null },
    {
      label: 'Przestępczość',
      value:
        crimeRate !== undefined ? `${formatNumber(crimeRate, 1)}/1000` : null,
    },
  ];

  return (
    <div
      className={`${styles.card} ${isHovered ? styles.cardHovered : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={
        isHovered
          ? {
              transform: 'translateY(-2px)',
              borderColor: 'var(--accent)',
              boxShadow: 'var(--shadow-medium)',
            }
          : { transition: 'all 0.2s' }
      }
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardPrice}>{building.price} zł</span>
        <div className={styles.cardHeaderRight}>
          <span className={styles.cardDistrict} title={building.district}>
            {building.district}
          </span>
          {email ? (
            <button
              className={`${styles.favoriteBtn} ${liked ? styles.favoriteBtnActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite({
                  id: building.id,
                  name: building.name,
                  district: building.district,
                  price: building.price,
                  noise_db: building.noise_db,
                });
              }}
              title={liked ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              aria-label={liked ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              {liked ? '♥' : '♡'}
            </button>
          ) : (
            <button
              className={styles.favoriteBtnLocked}
              onClick={(e) => {
                e.stopPropagation();
                navigate('/login');
              }}
              title="Zaloguj się, aby dodać do ulubionych"
              aria-label="Zaloguj się, aby dodać do ulubionych"
            >
              ♡
            </button>
          )}
        </div>
      </div>

      <div className={styles.cardTitle}>{building.name}</div>

      <div className={styles.cardFooter}>
        <button
          className={styles.cardButton}
          onClick={onToggleExpand}
          style={
            isExpanded
              ? {
                  background: 'var(--text-primary)',
                  color: 'var(--bg-base)',
                }
              : {}
          }
        >
          {isExpanded ? 'Zwiń szczegóły' : 'Szczegóły'}
        </button>
      </div>

      {isExpanded && (
        <div className={styles.details}>
          <dl className={styles.statGrid}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <dt className={styles.statLabel}>{stat.label}</dt>
                <dd
                  className={`${styles.statValue} ${stat.value === null ? styles.statEmpty : ''}`}
                >
                  {stat.value ?? '-'}
                </dd>
              </div>
            ))}
          </dl>

          {eduTypes.length > 0 && (
            <div className={styles.detailsSection}>
              <div className={styles.detailsTitle}>
                Placówki w promieniu {formatNumber(eduRadius, 1)} km
              </div>
              {facilities.length === 0 ? (
                <p className={styles.detailsEmpty}>Brak wybranych placówek.</p>
              ) : (
                <ul className={styles.facilityList}>
                  {facilities.slice(0, MAX_FACILITIES).map((facility, idx) => (
                    <li key={idx} className={styles.facility}>
                      <span className={styles.facilityName}>
                        {facility.name}
                      </span>
                      <span className={styles.facilityDistance}>
                        {facility.distanceKm < 1
                          ? `${Math.round(facility.distanceKm * 1000)} m`
                          : `${formatNumber(facility.distanceKm, 1)} km`}
                      </span>
                    </li>
                  ))}
                  {facilities.length > MAX_FACILITIES && (
                    <li className={styles.facilityMore}>
                      + {facilities.length - MAX_FACILITIES} więcej
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

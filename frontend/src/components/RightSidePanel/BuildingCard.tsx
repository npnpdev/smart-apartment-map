import styles from "./RightSidePanel.module.css";
import type { Building } from "./RightSidePanel";

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
}

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
}: Props) {
  const getFacilitiesForBuilding = (b: Building) => {
    if (eduTypes.length === 0 || educationData.length === 0) return [];

    const nearby = educationData.filter((facility: any) => {
      if (!eduTypes.includes(facility.education_type)) return false;

      const dist = getDistanceInKm(b.lat, b.lng, facility.lat, facility.lng);

      if (dist <= eduRadius) {
        facility.currentDistance = dist;
        return true;
      }

      return false;
    });

    return nearby.sort(
      (a: any, b: any) => a.currentDistance - b.currentDistance
    );
  };

  const facilities = isExpanded
    ? getFacilitiesForBuilding(building)
    : [];

  return (
    <div
      className={`${styles.card} ${isHovered ? styles.cardHovered : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={
        isHovered
          ? {
              transform: "translateY(-2px)",
              borderColor: "var(--accent)",
              boxShadow: "var(--shadow-medium)",
            }
          : { transition: "all 0.2s" }
      }
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardPrice}>{building.price} zł</span>
        <span className={styles.cardDistrict}>{building.district}</span>
      </div>

      <div className={styles.cardTitle}>{building.name}</div>

      <div className={styles.cardFooter}>
        <button
          className={styles.cardButton}
          onClick={onToggleExpand}
          style={
            isExpanded
              ? {
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }
              : {}
          }
        >
          {isExpanded ? "Zwiń szczegóły" : "Szczegóły"}
        </button>
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* SEKCJA HAŁAS */}
          <h4
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Otoczenie Akustyczne
          </h4>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(255,255,255,0.03)",
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>🔊</div>

            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  display: "block",
                }}
              >
                Szacowany poziom hałasu:
              </span>

              {building.noise_db ? (
                <strong
                  style={{
                    fontSize: "1.1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {building.noise_db}
                </strong>
              ) : (
                <span
                  style={{
                    color: "#888",
                    fontStyle: "italic",
                    fontSize: "0.9rem",
                  }}
                >
                  Brak danych
                </span>
              )}
            </div>
          </div>

          {/* SEKCJA EDUKACJA */}
          <h4
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Infrastruktura Edukacyjna
          </h4>

          {eduTypes.length === 0 ? (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#888",
                fontStyle: "italic",
              }}
            >
              Włącz filtr edukacji, aby zobaczyć placówki w okolicy.
            </p>
          ) : facilities.length === 0 ? (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#888",
                fontStyle: "italic",
              }}
            >
              Brak wybranych placówek w zadanym promieniu.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.85rem",
              }}
            >
              {facilities.map((fac: any, idx: number) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    background: "rgba(255,255,255,0.03)",
                    padding: "6px 10px",
                    borderRadius: "6px",
                  }}
                >
                  <span style={{ color: "var(--text-primary)" }}>
                    {fac.name
                      ? fac.name
                      : `${fac.education_type} (niezidentyfikowana)`}
                  </span>

                  <span
                    style={{
                      color: "#3b82f6",
                      fontWeight: 600,
                    }}
                  >
                    {(fac.currentDistance * 1000).toFixed(0)} m
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: "8px",
              borderLeft: "3px solid #3b82f6",
            }}
          >
            <p
              style={{
                fontSize: "0.8rem",
                margin: 0,
                color: "var(--text-primary)",
                lineHeight: 1.4,
              }}
            >
              <strong>Podsumowanie AI:</strong> Okolica korzystna dla rodzin.
              Znaleziono {facilities.length} placówek edukacyjnych.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
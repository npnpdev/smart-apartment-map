import stylesSidePanel from "../SidePanel/SidePanel.module.css";
import styles from "./RightSidePanel.module.css";
import { type Building } from "./RightSidePanel";
import { BuildingCard } from "./BuildingCard";

interface Props {
  view: "list" | "filters";
  buildings: Building[];
  visibleBuildings: Building[];

  totalPages: number;
  currentPage: number;
  onPageChange: (e: React.MouseEvent, dir: "prev" | "next") => void;

  hoveredBuildingId?: number | string | null;
  setHoveredBuildingId?: (id: number | string | null) => void;

  eduTypes: string[];
  educationData: any[];

  getDistanceInKm: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number;

  eduRadius: number;

  expandedBuildingId: number | string | null;
  setExpandedBuildingId: (id: number | string | null) => void;
}

export function RightSidePanelResults(props: Props) {
  const {
    view,
    buildings,
    visibleBuildings,

    totalPages,
    currentPage,
    onPageChange,

    hoveredBuildingId,
    setHoveredBuildingId,

    eduTypes,
    educationData,
    getDistanceInKm,
    eduRadius,

    expandedBuildingId,
    setExpandedBuildingId,
  } = props;

  if (view !== "list") return null;

  return (
    <div className={styles.resultsContainer}>
      {buildings.length === 0 ? (
        <div className={stylesSidePanel.empty}>
          <div>
            <div className={stylesSidePanel.emptyIcon}>🔍</div>
            <div className={stylesSidePanel.emptyText}>
              Brak ofert w wybranym zakresie.
              <br />
              Spróbuj zmienić parametry filtrów.
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.listWrapper}>
          <div className={styles.resultsCount}>
            Znaleziono: {buildings.length} ofert
          </div>

          {visibleBuildings.map((building) => {
            const isHovered = hoveredBuildingId === building.id;
            const isExpanded = expandedBuildingId === building.id;

            return (
              <BuildingCard
                key={building.id}
                building={building}
                isHovered={isHovered}
                isExpanded={isExpanded}
                onToggleExpand={() =>
                  setExpandedBuildingId(isExpanded ? null : building.id)
                }
                onMouseEnter={() =>
                  setHoveredBuildingId && setHoveredBuildingId(building.id)
                }
                onMouseLeave={() =>
                  setHoveredBuildingId && setHoveredBuildingId(null)
                }
                eduTypes={eduTypes}
                educationData={educationData}
                getDistanceInKm={getDistanceInKm}
                eduRadius={eduRadius}
              />
            );
          })}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                onClick={(e) => onPageChange(e, "prev")}
                disabled={currentPage === 1}
              >
                ←
              </button>

              <span className={styles.pageInfo}>
                Strona {currentPage} z {totalPages}
              </span>

              <button
                className={styles.pageButton}
                onClick={(e) => onPageChange(e, "next")}
                disabled={currentPage === totalPages}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useEffect } from 'react';
import styles from './RightSidePanel.module.css';
import { type Building } from './RightSidePanel';
import { BuildingCard } from './BuildingCard';
import { normalizeName } from '../Map/utils';

interface Props {
  view: 'list' | 'filters';
  buildings: Building[];
  visibleBuildings: Building[];

  currentPage: number;

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

  selectedBuildingId: number | string | null;
  setSelectedBuildingId: (id: number | string | null) => void;
  isLoadingBuildings?: boolean;
  safetyData?: Record<string, number>;
}

export function RightSidePanelResults(props: Props) {
  const {
    view,
    buildings,
    visibleBuildings,

    currentPage,

    hoveredBuildingId,
    setHoveredBuildingId,

    eduTypes,
    educationData,
    getDistanceInKm,
    eduRadius,

    selectedBuildingId,
    setSelectedBuildingId,
    isLoadingBuildings = false,
    safetyData = {},
  } = props;

  useEffect(() => {
    if (!selectedBuildingId) return;
    const el = document.getElementById(`building-card-${selectedBuildingId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedBuildingId, currentPage]);

  if (view !== 'list') return null;

  return (
    <div className={styles.resultsContainer}>
      {buildings.length === 0 ? (
        <div className={styles.emptyState}>
          {isLoadingBuildings ? (
            <p className={styles.emptyStateTitle}>Szukam ofert...</p>
          ) : (
            <>
              <p className={styles.emptyStateTitle}>Znaleziono: 0 ofert</p>
              <p className={styles.emptyStateDesc}>
                Zmień ustawione filtry, aby zobaczyć więcej mieszkań.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.listWrapper}>
          {visibleBuildings.map((building) => {
            const isHovered = hoveredBuildingId === building.id;
            const isExpanded = selectedBuildingId === building.id;

            return (
              <div key={building.id} id={`building-card-${building.id}`}>
                <BuildingCard
                  building={building}
                  isHovered={isHovered}
                  isExpanded={isExpanded}
                  onToggleExpand={() =>
                    setSelectedBuildingId(isExpanded ? null : building.id)
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
                  crimeRate={
                    building.district
                      ? safetyData[normalizeName(building.district)]
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

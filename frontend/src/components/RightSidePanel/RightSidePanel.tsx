import SidePanel from "../SidePanel/SidePanel.tsx";
import stylesSidePanel from "../SidePanel/SidePanel.module.css";
import styles from "./RightSidePanel.module.css";
import { useState, useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

import { RightSidePanelResults } from "./RightSidePanelResults";

// Konfiguracja
import { APP_CONFIG } from "../../constants";

// Definicja typu danych o budynku
export interface Building {
  id: number;
  name: string;
  district: string;
  price: number;
  lat: number;
  lng: number;
  noise_db?: string;
}

interface RightSidePanelProps {
  cityName: string;
  buildings: Building[];

  // Propsy do sterowania suwakiem bezpieczeństwa
  safetyThreshold: number;
  setSafetyThreshold: Dispatch<SetStateAction<number>>;
  safetyMin: number;
  safetyMax: number;

  // Propsy do sterowania hałasem
  noiseThreshold: number;
  setNoiseThreshold: Dispatch<SetStateAction<number>>;

  // Propsy do filtra edukacji
  eduTypes: string[];
  setEduTypes: Dispatch<SetStateAction<string[]>>;
  eduRadius: number;
  setEduRadius: Dispatch<SetStateAction<number>>;

  hoveredBuildingId?: number | string | null;
  setHoveredBuildingId?: (id: number | string | null) => void;
  
  educationDetails?: Record<string, { count: number; names: string[] }>;
  
  educationData?: any[];
  getDistanceInKm?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export default function RightSidePanel({
  buildings,
  safetyThreshold,
  setSafetyThreshold,
  safetyMin,
  safetyMax,
  noiseThreshold,        
  setNoiseThreshold,      
  eduTypes,
  setEduTypes,
  eduRadius,
  setEduRadius,
  hoveredBuildingId,      
  setHoveredBuildingId,
  educationDetails = {},
  educationData = [],
  getDistanceInKm = () => 0,
}: RightSidePanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<'list' | 'filters'>('list');
  
  // Stan do obsługi błędu suwaka edukacji, gdy nie wybrano żadnego typu placówki
  const [sliderError, setSliderError] = useState<string | null>(null);

  const [expandedBuildingId, setExpandedBuildingId] = useState<number | string | null>(null);

    useEffect(() => {
    setCurrentPage(1);
    setExpandedBuildingId(null);
  }, [safetyThreshold, eduTypes, eduRadius]);

  const totalPages = Math.ceil(buildings.length / APP_CONFIG.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * APP_CONFIG.ITEMS_PER_PAGE;
  const visibleBuildings = buildings.slice(startIndex, startIndex + APP_CONFIG.ITEMS_PER_PAGE);

  const handlePageChange = (e: React.MouseEvent, direction: 'prev' | 'next') => {
    e.stopPropagation();
    if (direction === 'prev' && currentPage > 1) setCurrentPage(p => p - 1);
    if (direction === 'next' && currentPage < totalPages) setCurrentPage(p => p + 1);
    setExpandedBuildingId(null);
  };

  const isSafetyFiltered = safetyThreshold <= safetyMax;
  const isEduFiltered = eduTypes.length > 0;
  const isNoiseFiltered = noiseThreshold < APP_CONFIG.DEFAULT_NOISE_LIMIT;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isSafetyFiltered) count++;
    if (isEduFiltered) count++;
    if (isNoiseFiltered) count++; // Dodajemy punkt za filtr hałasu
    return count;
  }, [isSafetyFiltered, isEduFiltered, isNoiseFiltered]);

  const resetFilters = () => {
    setSafetyThreshold(safetyMax + 1);
    setEduTypes([]);
    setEduRadius(APP_CONFIG.DEFAULT_EDU_RADIUS);
    setNoiseThreshold(APP_CONFIG.DEFAULT_NOISE_LIMIT);
    setSliderError(null);
  };

  const toggleEduType = (type: string) => {
    setEduTypes((prev) => {
      const newTypes = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      
      // Jeśli użytkownik wybiera jakikolwiek typ, usuwamy komunikat błędu suwaka
      if (newTypes.length > 0) {
        setSliderError(null);
      }
      return newTypes;
    });
  };

  // Obsługa kliknięcia nieaktywnego suwaka edukacji
  const handleSliderContainerClick = () => {
    if (eduTypes.length === 0) {
      setSliderError("Najpierw wybierz rodzaj placówki (np. Przedszkola) by użyć promienia.");
    }
  };

  return (
    <SidePanel
      side="right"
      title="Gdańsk Housing"
      subtitle="PLATFORMA ANALITYCZNA"
      width={560}
    >

      {/* --- SEKCJA GŁÓWNA (ZARZĄDZANIE WIDOKAMI) --- */}
      <div className={styles.filtersWrapper}>
        
        {/* WIDOK 1: PRZYCISK FILTRÓW I RESET */}
        {view === 'list' && (
          <div className={styles.mainControls}>
            <button 
              className={styles.mainFilterButton} 
              onClick={() => setView('filters')}
            >
              Filtry
              {activeFilterCount > 0 && (
                <span className={styles.activeFilterBadge}>{activeFilterCount}</span>
              )}
            </button>

            {activeFilterCount > 0 && (
               <button className={styles.resetButton} onClick={resetFilters}>
                 Resetuj ✕
               </button>
            )}
          </div>
        )}

        {/* WIDOK 2: PIONOWA LISTA FILTRÓW */}
        {view === 'filters' && (
          <div className={styles.filtersPage}>
            <button className={styles.backButton} onClick={() => setView('list')}>
              ← Wróć do wyników
            </button>

            {/* SEKCJA 1: BEZPIECZEŃSTWO */}
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Poziom Bezpieczeństwa</h3>
              <div className={styles.sliderContainer}>
                <div className={styles.sliderLabels}>
                  <span>Najbezpieczniejsze</span>
                  <span>Wszystkie</span>
                </div>
                
                <input 
                  type="range" 
                  min={safetyMin} 
                  max={safetyMax + 1} 
                  value={safetyThreshold} 
                  onChange={(e) => setSafetyThreshold(Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={styles.sliderInput}
                />
                
                <div className={styles.sliderValue}>
                  {safetyThreshold > safetyMax ? (
                    <strong>Pokazuję wszystkie dzielnice</strong>
                  ) : (
                    <>
                      Max: <strong>{safetyThreshold}</strong> zgłoszeń/1k
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* SEKCJA 2: EDUKACJA */}
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Placówki edukacyjne</h3>
              <div className={styles.eduTypesWrapper}>
                <span className={styles.sectionLabel}>Wybierz rodzaj:</span>
                <div className={styles.eduTypesContainer}>
                  {APP_CONFIG.AVAILABLE_EDU_TYPES.map(type => {
                    const isActive = eduTypes.includes(type);
                    const count = educationDetails[type]?.count || 0; 

                    return (
                      <button 
                        key={type}
                        onClick={() => toggleEduType(type)}
                        className={`${styles.eduTypeChip} ${isActive ? styles.eduTypeChipActive : ''}`}
                      >
                        {type} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div 
                className={styles.sliderContainer} 
                style={{ marginTop: '20px', opacity: eduTypes.length === 0 ? 0.5 : 1 }}
                onClick={handleSliderContainerClick}
              >
                <span className={styles.sectionLabel}>Maksymalna odległość:</span>
                
                {sliderError && (
                  <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 'bold' }}>
                    {sliderError}
                  </div>
                )}

                <div className={styles.sliderLabels} style={{ marginTop: '8px' }}>
                  <span>0.5 km</span>
                  <span>5 km</span>
                </div>
                
                <input 
                  type="range" 
                  min="0.5" 
                  max="5" 
                  step="0.5"
                  value={eduRadius} 
                  onChange={(e) => setEduRadius(Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={styles.sliderInput}
                  disabled={eduTypes.length === 0} 
                  style={{ cursor: eduTypes.length === 0 ? 'not-allowed' : 'pointer' }}
                />
                
                <div className={styles.sliderValue}>
                  W promieniu: <strong>{eduRadius} km</strong>
                </div>
              </div>           
            </div>
            
            {/* SEKCJA 3: HAŁAS */}
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Maksymalny Poziom Hałasu</h3>
              
              <div className={styles.sliderContainer}>
                <div className={styles.sliderLabels}>
                  <span>Cicho (55 dB)</span>
                  <span>Głośno (75+ dB)</span>
                </div>
                
                <input 
                  type="range" 
                  min="50" 
                  max="80" 
                  step="5"
                  value={noiseThreshold} 
                  onChange={(e) => setNoiseThreshold(Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={styles.sliderInput}
                />
                
                <div className={styles.sliderValue}>
                  Max: <strong>{noiseThreshold >= 80 ? 'Brak limitu' : `${noiseThreshold} dB`}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- SEKCJA WYNIKÓW --- */}
      <RightSidePanelResults
        view={view}
        buildings={buildings}
        visibleBuildings={visibleBuildings}
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        hoveredBuildingId={hoveredBuildingId}
        setHoveredBuildingId={setHoveredBuildingId}
        eduTypes={eduTypes}
        educationData={educationData}
        getDistanceInKm={getDistanceInKm}     
        eduRadius={eduRadius}               
        expandedBuildingId={expandedBuildingId}
        setExpandedBuildingId={setExpandedBuildingId}
      />
    </SidePanel>
  );
}
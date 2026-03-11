import SidePanel from "../SidePanel/SidePanel.tsx";
import stylesSidePanel from "../SidePanel/SidePanel.module.css";
import styles from "./RightSidePanel.module.css";
import { useState, useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";

// Definicja typu danych o budynku
export interface Building {
  id: number;
  name: string;
  district: string;
  price: number;
  lat: number;
  lng: number;
  noise_level?: string;
}

interface RightSidePanelProps {
  cityName: string;
  buildings: Building[];

  // Propsy do sterowania suwakiem bezpieczeństwa
  safetyThreshold: number;
  setSafetyThreshold: Dispatch<SetStateAction<number>>;
  safetyMin: number;
  safetyMax: number;

  // Propsy do filtra edukacji
  eduTypes: string[];
  setEduTypes: Dispatch<SetStateAction<string[]>>;
  eduRadius: number;
  setEduRadius: Dispatch<SetStateAction<number>>;

  hoveredBuildingId?: number | string | null;
  setHoveredBuildingId?: (id: number | string | null) => void;
}

const ITEMS_PER_PAGE = 5;

const AVAILABLE_EDU_TYPES =["Przedszkola", "Podstawowe", "Średnie", "Uczelnie"];

export default function RightSidePanel({
  buildings,
  safetyThreshold,
  setSafetyThreshold,
  safetyMin,
  safetyMax,
  eduTypes,
  setEduTypes,
  eduRadius,
  setEduRadius,
  hoveredBuildingId,      
  setHoveredBuildingId,
}: RightSidePanelProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  // Stan: kontroluje widok (lista wyników vs strona z filtrami)
  const [view, setView] = useState<'list' | 'filters'>('list');

  // Resetujemy paginację przy zmianie filtrów
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  },[buildings, safetyThreshold, eduTypes, eduRadius]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const visibleBuildings = buildings.slice(0, visibleCount);
  const hasMore = visibleCount < buildings.length;

  // Sprawdzamy czy filtry są aktywne
  const isSafetyFiltered = safetyThreshold <= safetyMax;
  const isEduFiltered = eduTypes.length > 0;

  // Obliczanie liczby aktywnych filtrów dla odznaki
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isSafetyFiltered) count++;
    if (isEduFiltered) count++;
    return count;
  }, [isSafetyFiltered, isEduFiltered]);

  // Funkcja resetująca stany wszystkich filtrów (bez zmiany widoku)
  const resetFilters = () => {
    setSafetyThreshold(safetyMax + 1);
    setEduTypes([]); 
    setEduRadius(5); 
  };

  // Funkcja dodająca/usuwająca dany typ edukacji z listy
  const toggleEduType = (type: string) => {
    setEduTypes((prev) => 
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
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
                  {AVAILABLE_EDU_TYPES.map(type => {
                    const isActive = eduTypes.includes(type);
                    return (
                      <button 
                        key={type}
                        onClick={() => toggleEduType(type)}
                        className={`${styles.eduTypeChip} ${isActive ? styles.eduTypeChipActive : ''}`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.sliderContainer} style={{ marginTop: '20px' }}>
                <span className={styles.sectionLabel}>Maksymalna odległość:</span>
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
                />
                
                <div className={styles.sliderValue}>
                  W promieniu: <strong>{eduRadius} km</strong>
                </div>
              </div>
            </div>
            
            {/* SEKCJA 3: INFO O PRZYSZŁYCH FILTRACH */}
            <div className={styles.filterSection}>
              <h3 className={styles.filterSectionTitle}>Hałas i Budżet</h3>
              <p className={styles.placeholderText}>Opcje filtrowania na podstawie hałasu i budżetu pojawią się w przyszłych wersjach platformy.</p>
            </div>
            
          </div>
        )}
      </div>

      {/* --- LISTA WYNIKÓW (POKAZYWANA TYLKO W WIDOKU 'LIST') --- */}
      {view === 'list' && (
        <div className={styles.resultsContainer}>
          {buildings.length === 0 ? (
            <div className={stylesSidePanel.empty}>
              <div>
                <div className={stylesSidePanel.emptyIcon}>🔍</div>
                <div className={stylesSidePanel.emptyText}>
                  Brak ofert w wybranym zakresie.
                  <br/>
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
                
                return (
                  <div 
                    key={building.id} 
                    className={`${styles.card} ${isHovered ? styles.cardHovered : ""}`}
                    onMouseEnter={() => setHoveredBuildingId && setHoveredBuildingId(building.id)}
                    onMouseLeave={() => setHoveredBuildingId && setHoveredBuildingId(null)}
                    style={isHovered ? { transform: 'translateY(-2px)', borderColor: 'var(--accent)', boxShadow: 'var(--shadow-medium)' } : { transition: 'all 0.2s' }}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardPrice}>{building.price} zł</span>
                      <span className={styles.cardDistrict}>{building.district}</span>
                    </div>
                    <div className={styles.cardTitle}>{building.name}</div>
                    <div className={styles.cardFooter}>
                        <button className={styles.cardButton}>Szczegóły</button>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button onClick={handleLoadMore} className={styles.loadMoreBtn}>
                  Załaduj więcej (+{buildings.length - visibleCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </SidePanel>
  );
}
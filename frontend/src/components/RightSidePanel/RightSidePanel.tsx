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
  
  educationDetails?: Record<string, { count: number; names: string[] }>;
  
  educationData?: any[];
  getDistanceInKm?: (lat1: number, lon1: number, lat2: number, lon2: number) => number;

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
  educationDetails = {},
  educationData = [],
  getDistanceInKm = () => 0,
}: RightSidePanelProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [view, setView] = useState<'list' | 'filters'>('list');
  
  // NOWY STAN: do obsługi komunikatu błędu dla zablokowanego suwaka
  const [sliderError, setSliderError] = useState<string | null>(null);

  const [expandedBuildingId, setExpandedBuildingId] = useState<number | string | null>(null);

  // (reszta useEffect i funkcji pozostaje jak u Ciebie)
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  },[buildings, safetyThreshold, eduTypes, eduRadius]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const visibleBuildings = buildings.slice(0, visibleCount);
  const hasMore = visibleCount < buildings.length;

  const isSafetyFiltered = safetyThreshold <= safetyMax;
  const isEduFiltered = eduTypes.length > 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (isSafetyFiltered) count++;
    if (isEduFiltered) count++;
    return count;
  }, [isSafetyFiltered, isEduFiltered]);

  const resetFilters = () => {
    setSafetyThreshold(safetyMax + 1);
    setEduTypes([]); 
    setEduRadius(5); 
    setSliderError(null); // Czyszczenie ew. błędu
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

  // NOWA FUNKCJA: Obsługa kliknięcia zablokowanego suwaka
  const handleSliderContainerClick = () => {
    if (eduTypes.length === 0) {
      setSliderError("Najpierw wybierz rodzaj placówki (np. Przedszkola) by użyć promienia.");
    }
  };

  // NOWA FUNKCJA OBLICZAJĄCA ZNALEZIONĄ INFRASTRUKTURĘ DLA JEDNEGO DOMU
  const getFacilitiesForBuilding = (building: Building) => {
    if (eduTypes.length === 0 || educationData.length === 0) return [];
    
    const nearby = educationData.filter((facility: any) => {
      if (!eduTypes.includes(facility.education_type)) return false;
      const dist = getDistanceInKm(building.lat, building.lng, facility.lat, facility.lng);
      if (dist <= eduRadius) {
        facility.currentDistance = dist;
        return true;
      }
      return false;
    });

    return nearby.sort((a: any, b: any) => a.currentDistance - b.currentDistance);
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
                const isExpanded = expandedBuildingId === building.id;
                const facilities = isExpanded ? getFacilitiesForBuilding(building) : [];
                
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
                        <button 
                          className={styles.cardButton}
                          onClick={() => setExpandedBuildingId(isExpanded ? null : building.id)}
                          style={isExpanded ? { background: 'var(--text-primary)', color: 'var(--bg-base)' } : {}}
                        >
                          {isExpanded ? 'Zwiń szczegóły' : 'Szczegóły'}
                        </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Infrastruktura Edukacyjna
                        </h4>
                        
                        {eduTypes.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>Włącz filtr edukacji, aby zobaczyć placówki w okolicy.</p>
                        ) : facilities.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>Brak wybranych placówek w zadanym promieniu.</p>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                            {facilities.map((fac: any, idx: number) => (
                              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-primary)' }}> {fac.name ? fac.name : `${fac.education_type} (niezidentyfikowana)`} </span>

                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{(fac.currentDistance * 1000).toFixed(0)} m</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                          <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                            <strong>Podsumowanie AI:</strong> Okolica korzystna dla rodzin. Znaleziono {facilities.length} placówek edukacyjnych.
                          </p>
                        </div>
                      </div>
                    )}
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
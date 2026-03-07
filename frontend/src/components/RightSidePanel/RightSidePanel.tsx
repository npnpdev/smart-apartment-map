import SidePanel from "../SidePanel/SidePanel.tsx";
import stylesSidePanel from "../SidePanel/SidePanel.module.css";
import styles from "./RightSidePanel.module.css";
import { useState, useEffect } from "react";
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
  onChangeCity: () => void;
  buildings: Building[];

  // NOWOŚĆ: Propsy do sterowania suwakiem bezpieczeństwa
  safetyThreshold: number;
  setSafetyThreshold: Dispatch<SetStateAction<number>>;
  safetyMin: number;
  safetyMax: number;
}

const ITEMS_PER_PAGE = 5;

// Typ określający, który filtr jest aktualnie rozwinięty
type FilterType = 'safety' | 'noise' | 'budget' | null;

export default function RightSidePanel({
  cityName,
  onChangeCity,
  buildings,
  safetyThreshold,
  setSafetyThreshold,
  safetyMin,
  safetyMax
}: RightSidePanelProps) {
  const [hovered, setHovered] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  // Stan: który filtr jest rozwinięty? (null = widok ogólny)
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

  // Resetujemy paginację przy zmianie filtrów
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [buildings, safetyThreshold]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const visibleBuildings = buildings.slice(0, visibleCount);
  const hasMore = visibleCount < buildings.length;

  // Funkcja resetująca filtry
  const resetFilters = () => {
    setActiveFilter(null);
    setSafetyThreshold(safetyMax + 1); // Ustawiamy próg powyżej max, żeby pokazać wszystko
  };

  // Sprawdzamy czy filtr jest aktywny (czy suwak został ruszony)
  const isSafetyFiltered = safetyThreshold <= safetyMax;

  return (
    <SidePanel
      side="right"
      title="Gdańsk Housing"
      subtitle="PLATFORMA ANALITYCZNA"
      width={560}
    >
      <button
        className={styles.chip}
        type="button"
        onClick={onChangeCity}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered ? "Zmień miasto" : cityName}
      </button>

      {/* --- SEKCJA FILTRÓW (DYNAMICZNA) --- */}
      <div className={styles.filtersWrapper}>
        
        {/* WIDOK 1: GŁÓWNA LISTA KAFELKÓW (Gdy nic nie jest rozwinięte) */}
        {activeFilter === null && (
          <div className={stylesSidePanel.chips}>
            {/* Kafelek Bezpieczeństwo */}
            <button 
              className={`${stylesSidePanel.chip} ${isSafetyFiltered ? stylesSidePanel.chipActive : ''}`}
              onClick={() => setActiveFilter('safety')}
            >
              Bezpieczeństwo {isSafetyFiltered && '✓'}
            </button>

            {/* Inne kafelki (na razie atrapy) */}
            <button className={stylesSidePanel.chip} onClick={() => setActiveFilter('noise')}>
              Hałas
            </button>
            <button className={stylesSidePanel.chip} onClick={() => setActiveFilter('budget')}>
              Budżet
            </button>

            {/* Przycisk Reset */}
            {isSafetyFiltered && (
               <button className={styles.resetButton} onClick={resetFilters}>
                 Resetuj filtry ✕
               </button>
            )}
          </div>
        )}

        {/* WIDOK 2: ROZWINIĘTY FILTR BEZPIECZEŃSTWA */}
        {activeFilter === 'safety' && (
          <div className={styles.expandedFilter}>
            <div className={styles.expandedHeader}>
              <button className={styles.backButton} onClick={() => setActiveFilter(null)}>
                ← Wróć
              </button>
              <span className={styles.expandedTitle}>Poziom Bezpieczeństwa</span>
            </div>
            
            <div className={styles.sliderContainer}>
              <div className={styles.sliderLabels}>
                <span>Najbezpieczniejsze</span>
                <span>Wszystkie</span>
              </div>
              
              <input 
                type="range" 
                min={safetyMin} 
                max={safetyMax + 1} // +1 pozwala wybrać opcję "Wszystkie"
                value={safetyThreshold} 
                onChange={(e) => setSafetyThreshold(Number(e.target.value))}
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
        )}

        {/* Placeholder dla innych filtrów */}
        {(activeFilter === 'noise' || activeFilter === 'budget') && (
           <div className={styles.expandedFilter}>
             <button className={styles.backButton} onClick={() => setActiveFilter(null)}>← Wróć</button>
             <p style={{padding: '20px', textAlign: 'center', color: '#888'}}>Tu będzie filtr {activeFilter}...</p>
           </div>
        )}

      </div>

      {/* --- LISTA WYNIKÓW --- */}
      <div className={styles.resultsContainer}>
        {buildings.length === 0 ? (
          <div className={stylesSidePanel.empty}>
            <div>
              <div className={stylesSidePanel.emptyIcon}>🔍</div>
              <div className={stylesSidePanel.emptyText}>
                Brak ofert w wybranym zakresie bezpieczeństwa.
                <br/>
                Spróbuj przesunąć suwak w prawo.
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.listWrapper}>
            <div className={styles.resultsCount}>
               Znaleziono: {buildings.length} ofert
            </div>

            {visibleBuildings.map((building) => (
              <div key={building.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardPrice}>{building.price} zł</span>
                  <span className={styles.cardDistrict}>{building.district}</span>
                </div>
                <div className={styles.cardTitle}>{building.name}</div>
                <div className={styles.cardFooter}>
                    <button className={styles.cardButton}>Szczegóły</button>
                </div>
              </div>
            ))}

            {hasMore && (
              <button onClick={handleLoadMore} className={styles.loadMoreBtn}>
                Załaduj więcej (+{buildings.length - visibleCount})
              </button>
            )}
          </div>
        )}
      </div>
    </SidePanel>
  );
}
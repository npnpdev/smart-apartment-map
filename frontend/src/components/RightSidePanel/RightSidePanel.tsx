import SidePanel from '../SidePanel/SidePanel.tsx';
import styles from './RightSidePanel.module.css';
import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext.tsx';

import { RightSidePanelResults } from './RightSidePanelResults';
import {
  ChipGroup,
  DistrictPicker,
  Field,
  FilterGroup,
  MoreToggle,
  RangeFilter,
  SliderFilter,
  ToggleSwitch,
} from './filters/FilterControls';
import {
  type ApartmentFilters,
  DEFAULT_APARTMENT_FILTERS,
  FILTER_LIMITS,
  FLOOR_OPTIONS,
  ROOM_OPTIONS,
  YEAR_BUILT_OPTIONS,
  countApartmentFilters,
} from './filters/apartmentFilters';

// Konfiguracja
import { APP_CONFIG } from '../../constants';

// Definicja typu danych o budynku
export interface Building {
  id: number;
  name: string;
  district: string;
  price: number;
  lat: number;
  lng: number;
  noise_db?: string;
  // szczegóły z API (Decimal przychodzi jako string)
  area?: string | number | null;
  rooms?: number | null;
  floor?: number | null;
  year_built?: number | null;
  has_elevator?: boolean | null;
  price_per_m2?: number | null;
  source_url?: string | null;
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

  // wybrane mieszkanie - wspólne z mapą (kliknięcie znacznika / "Szczegóły")
  selectedBuildingId: number | string | null;
  setSelectedBuildingId: (id: number | string | null) => void;

  educationDetails?: Record<string, { count: number; names: string[] }>;

  educationData?: any[];
  getDistanceInKm?: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number;
  isLoadingBuildings?: boolean;
  // wskaźnik przestępstw na 1000 os. wg dzielnicy (klucze po normalizeName)
  safetyData?: Record<string, number>;

  // Filtry parametrów mieszkania (stan w Map, filtrowane w API)
  apartmentFilters: ApartmentFilters;
  setApartmentFilters: Dispatch<SetStateAction<ApartmentFilters>>;
  districtNames: string[];
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
  selectedBuildingId,
  setSelectedBuildingId,
  educationDetails = {},
  educationData = [],
  getDistanceInKm = () => 0,
  isLoadingBuildings = false,
  safetyData = {},
  apartmentFilters,
  setApartmentFilters,
  districtNames,
}: RightSidePanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<'list' | 'filters'>('list');

  const [searchParams, setSearchParams] = useSearchParams();
  const { cities, currentCity, changeCity } = useAppContext();

  const updateApartmentFilters = (patch: Partial<ApartmentFilters>) =>
    setApartmentFilters((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    setCurrentPage(1);
    setSelectedBuildingId(null);
  }, [
    safetyThreshold,
    eduTypes,
    eduRadius,
    apartmentFilters,
    setSelectedBuildingId,
  ]);

  // Wybór z mapy (albo z ?highlight): przejście na stronę z ofertą i widok listy.
  // Liczone przy renderze, gdy zmieni się wybór - bez dodatkowego efektu.
  const [syncedSelectionId, setSyncedSelectionId] =
    useState(selectedBuildingId);
  if (selectedBuildingId !== syncedSelectionId) {
    setSyncedSelectionId(selectedBuildingId);
    const idx = buildings.findIndex((b) => b.id === selectedBuildingId);
    if (idx !== -1) {
      setCurrentPage(Math.floor(idx / APP_CONFIG.ITEMS_PER_PAGE) + 1);
      setView('list');
    }
  }

  // ?highlight=ID (np. "Pokaż na mapie" z ulubionych) — wybiera ogłoszenie,
  // a dalej działa jak kliknięcie znacznika: strona z ofertą + przybliżenie mapy
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId || buildings.length === 0) return;
    const id = Number(highlightId);
    if (buildings.some((b) => b.id === id)) setSelectedBuildingId(id);
    setSearchParams({}, { replace: true });
  }, [searchParams, buildings]);

  const totalPages = Math.ceil(buildings.length / APP_CONFIG.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * APP_CONFIG.ITEMS_PER_PAGE;
  const visibleBuildings = buildings.slice(
    startIndex,
    startIndex + APP_CONFIG.ITEMS_PER_PAGE
  );

  const handlePageChange = (
    e: React.MouseEvent,
    direction: 'prev' | 'next'
  ) => {
    e.stopPropagation();
    if (direction === 'prev' && currentPage > 1) setCurrentPage((p) => p - 1);
    if (direction === 'next' && currentPage < totalPages)
      setCurrentPage((p) => p + 1);
    setSelectedBuildingId(null);
  };

  const isSafetyFiltered = safetyThreshold <= safetyMax;
  const isEduFiltered = eduTypes.length > 0;
  const isNoiseFiltered = noiseThreshold < APP_CONFIG.DEFAULT_NOISE_LIMIT;

  // Liczba aktywnych filtrów w każdej sekcji (plakietki w nagłówkach sekcji)
  const apartmentCount = countApartmentFilters(apartmentFilters);
  const districtCount = apartmentFilters.districts.length > 0 ? 1 : 0;
  const neighborhoodCount = [
    isSafetyFiltered,
    isEduFiltered,
    isNoiseFiltered,
  ].filter(Boolean).length;
  const activeFilterCount = apartmentCount + districtCount + neighborhoodCount;

  const resetFilters = () => {
    setApartmentFilters(DEFAULT_APARTMENT_FILTERS);
    setSafetyThreshold(safetyMax + 1);
    setEduTypes([]);
    setEduRadius(APP_CONFIG.DEFAULT_EDU_RADIUS);
    setNoiseThreshold(APP_CONFIG.DEFAULT_NOISE_LIMIT);
  };

  // Stały pasek u góry panelu: "Filtry" w widoku listy, "Pokaż X ofert" w widoku filtrów
  const toolbar = (
    <div className={styles.toolbarStack}>
      {/* Wybór miasta - przybliża mapę, nie filtruje ofert */}
      <div
        className={styles.citySwitch}
        role="group"
        aria-label="Przybliż mapę do miasta"
      >
        {cities.map((city) => (
          <button
            key={city.name}
            type="button"
            className={`${styles.citySwitchButton} ${city.name === currentCity.name ? styles.citySwitchButtonActive : ''}`}
            aria-pressed={city.name === currentCity.name}
            onClick={() => changeCity(city.name)}
          >
            {city.name}
          </button>
        ))}
      </div>

      <div className={styles.mainControls}>
        {view === 'list' ? (
          <>
            <button
              className={styles.mainFilterButton}
              onClick={() => setView('filters')}
            >
              Filtry
              {activeFilterCount > 0 && (
                <span className={styles.activeFilterBadge}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button className={styles.resetButton} onClick={resetFilters}>
                Resetuj ✕
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className={styles.mainFilterButton}
              onClick={() => setView('list')}
            >
              {isLoadingBuildings
                ? 'Szukam ofert...'
                : `Pokaż ${buildings.length} ofert`}
            </button>
            {activeFilterCount > 0 && (
              <button className={styles.resetButton} onClick={resetFilters}>
                Resetuj ({activeFilterCount})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Stała stopka panelu: liczba ofert i paginacja zawsze w tym samym miejscu na dole
  const footer =
    view === 'list' && buildings.length > 0 ? (
      <div className={styles.footerStack}>
        <div className={styles.resultsCount}>
          {isLoadingBuildings
            ? 'Szukam ofert...'
            : `Znaleziono: ${buildings.length} ofert`}
        </div>
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            onClick={(e) => handlePageChange(e, 'prev')}
            disabled={currentPage === 1}
            aria-label="Poprzednia strona"
          >
            ←
          </button>

          <span className={styles.pageInfo}>
            Strona {currentPage} z {Math.max(totalPages, 1)}
          </span>

          <button
            className={styles.pageButton}
            onClick={(e) => handlePageChange(e, 'next')}
            disabled={currentPage >= totalPages}
            aria-label="Następna strona"
          >
            →
          </button>
        </div>
      </div>
    ) : null;

  return (
    <SidePanel
      side="right"
      width={560}
      toolbar={toolbar}
      footer={footer}
      openSignal={selectedBuildingId}
    >
      {/* --- WIDOK FILTRÓW (ZWIJANE SEKCJE) --- */}
      <div className={styles.filtersWrapper}>
        {/* WIDOK 2: FILTRY W ZWIJANYCH SEKCJACH */}
        {view === 'filters' && (
          <div className={styles.filtersPage}>
            {/* Wyszukiwarka dzielnic - bez kategorii i etykiety, nad sekcjami */}
            <div className={styles.standaloneField}>
              <DistrictPicker
                options={districtNames}
                selected={apartmentFilters.districts}
                onChange={(districts) => updateApartmentFilters({ districts })}
              />
            </div>

            {/* SEKCJA: MIESZKANIE */}
            <FilterGroup
              id="apartment"
              title="Mieszkanie"
              activeCount={apartmentCount}
            >
              <Field label="Cena (zł / mies.)">
                <RangeFilter
                  value={apartmentFilters.price}
                  onChange={(price) => updateApartmentFilters({ price })}
                  limits={FILTER_LIMITS.price}
                  unit="zł"
                />
              </Field>

              <Field label="Liczba pokoi">
                <ChipGroup
                  ariaLabel="Liczba pokoi"
                  options={ROOM_OPTIONS}
                  selected={apartmentFilters.rooms}
                  onChange={(rooms) => updateApartmentFilters({ rooms })}
                />
              </Field>

              <Field label="Metraż">
                <RangeFilter
                  value={apartmentFilters.area}
                  onChange={(area) => updateApartmentFilters({ area })}
                  limits={FILTER_LIMITS.area}
                  unit="m²"
                />
              </Field>

              <Field label="Piętro">
                <ChipGroup
                  ariaLabel="Piętro"
                  options={FLOOR_OPTIONS}
                  selected={apartmentFilters.floors}
                  onChange={(floors) => updateApartmentFilters({ floors })}
                />
              </Field>

              <Field label="Rok budowy">
                <ChipGroup
                  ariaLabel="Rok budowy"
                  options={YEAR_BUILT_OPTIONS}
                  selected={apartmentFilters.yearBuilt}
                  onChange={(yearBuilt) =>
                    updateApartmentFilters({ yearBuilt })
                  }
                />
              </Field>

              <ToggleSwitch
                label="Tylko z windą"
                checked={apartmentFilters.elevatorOnly}
                onChange={(elevatorOnly) =>
                  updateApartmentFilters({ elevatorOnly })
                }
              />

              <MoreToggle label="Więcej: cena za m²">
                <Field label="Cena za m² (zł)">
                  <RangeFilter
                    value={apartmentFilters.pricePerM2}
                    onChange={(pricePerM2) =>
                      updateApartmentFilters({ pricePerM2 })
                    }
                    limits={FILTER_LIMITS.pricePerM2}
                    unit="zł/m²"
                  />
                </Field>
              </MoreToggle>
            </FilterGroup>

            {/* SEKCJA: OKOLICA (dotychczasowe filtry) */}
            <FilterGroup
              id="neighborhood"
              title="Okolica"
              activeCount={neighborhoodCount}
              defaultOpen={false}
            >
              <Field label="Poziom bezpieczeństwa">
                <SliderFilter
                  value={safetyThreshold}
                  onChange={setSafetyThreshold}
                  min={safetyMin}
                  max={safetyMax + 1}
                  step={1}
                  minLabel="Najbezpieczniejsze"
                  maxLabel="Wszystkie"
                  valueLabel={
                    safetyThreshold > safetyMax
                      ? 'Wszystkie dzielnice'
                      : `Maks. ${safetyThreshold} zgłoszeń / 1000 os.`
                  }
                />
              </Field>

              <Field label="Placówki edukacyjne w pobliżu">
                <ChipGroup
                  ariaLabel="Rodzaj placówki"
                  options={APP_CONFIG.AVAILABLE_EDU_TYPES.map((type) => ({
                    value: type,
                    label: `${type} (${educationDetails[type]?.count || 0})`,
                  }))}
                  selected={eduTypes}
                  onChange={setEduTypes}
                />
              </Field>

              <Field
                label="Odległość do placówki"
                hint={
                  eduTypes.length === 0
                    ? 'Najpierw wybierz rodzaj placówki, aby ustawić odległość.'
                    : undefined
                }
              >
                <SliderFilter
                  value={eduRadius}
                  onChange={setEduRadius}
                  min={0.5}
                  max={5}
                  step={0.5}
                  minLabel="0,5 km"
                  maxLabel="5 km"
                  valueLabel={`W promieniu ${String(eduRadius).replace('.', ',')} km`}
                  disabled={eduTypes.length === 0}
                />
              </Field>

              <Field label="Maksymalny poziom hałasu">
                <SliderFilter
                  value={noiseThreshold}
                  onChange={setNoiseThreshold}
                  min={50}
                  max={80}
                  step={5}
                  minLabel="Cicho (50 dB)"
                  maxLabel="Głośno (80 dB)"
                  valueLabel={
                    noiseThreshold >= 80
                      ? 'Bez limitu'
                      : `Maks. ${noiseThreshold} dB`
                  }
                />
              </Field>
            </FilterGroup>
          </div>
        )}
      </div>

      {/* --- SEKCJA WYNIKÓW --- */}
      <RightSidePanelResults
        view={view}
        buildings={buildings}
        visibleBuildings={visibleBuildings}
        currentPage={currentPage}
        hoveredBuildingId={hoveredBuildingId}
        setHoveredBuildingId={setHoveredBuildingId}
        eduTypes={eduTypes}
        educationData={educationData}
        getDistanceInKm={getDistanceInKm}
        eduRadius={eduRadius}
        selectedBuildingId={selectedBuildingId}
        setSelectedBuildingId={setSelectedBuildingId}
        isLoadingBuildings={isLoadingBuildings}
        safetyData={safetyData}
      />
    </SidePanel>
  );
}

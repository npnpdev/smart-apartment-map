import { useEffect, useMemo, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  GeoJSON,
  Circle,
  Tooltip,
} from 'react-leaflet';
import L from 'leaflet';
import { useSearchParams } from 'react-router-dom';
import 'leaflet.vectorgrid';

// Konfiguracja
import { APP_CONFIG } from '../../constants';

// Globalny kontekst i typy
import { useAppContext } from '../../context/AppContext.tsx';

// Własne komponenty (Podkomponenty mapy i UI)
import FixMapSize from './FixMapSize';
import VectorNoiseLayer from './VectorNoiseLayer';
import ClusteredBuildings from './ClusteredBuildings';
import FocusSelectedBuilding from './FocusSelectedBuilding';
import MapController from '../MapController/MapController.tsx';
import RightSidePanel from '../RightSidePanel/RightSidePanel.tsx';

// Custom Hooki (Logika, dane i filtry)
import { useMapData } from './useMapData';
import { useMapFilters } from './useMapFilters';

// Narzędzia i stylizacje
import { getDistanceInKm, normalizeName } from './utils.ts';
import {
  educationMarkerIcon,
  getSafetyLabel,
  getColor,
  getTextColor,
} from './mapStyles';

// Style CSS
import styles from './Map.module.css';

import ChatWidget from '../ChatWidget/ChatWidget';
import {
  type ApartmentFilters,
  DEFAULT_APARTMENT_FILTERS,
} from '../RightSidePanel/filters/apartmentFilters';

function Map() {
  const { currentCity, chatFilters } = useAppContext();

  // --- ZAPYTANIE ZE STRONY GŁÓWNEJ (?q=...) -> wysyłane do chatu ---
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialChatQuery] = useState(
    () => searchParams.get('q')?.trim() || null
  );

  useEffect(() => {
    // usuwamy q z adresu, żeby odświeżenie strony nie wysłało pytania ponownie
    if (searchParams.has('q')) {
      setSearchParams(
        (params) => {
          params.delete('q');
          return params;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  // --- STAN HOVERA MIESZKAŃ ---
  const [hoveredBuildingId, setHoveredBuildingId] = useState<
    number | string | null
  >(null);

  // --- WYBRANE MIESZKANIE (wspólne dla mapy i panelu) ---
  // "Szczegóły" w panelu przybliża mapę; kliknięcie znacznika otwiera szczegóły w panelu
  const [selectedBuildingId, setSelectedBuildingId] = useState<
    number | string | null
  >(null);
  // najechane ma pierwszeństwo, inaczej pokazujemy okolicę wybranego
  const focusedBuildingId = hoveredBuildingId ?? selectedBuildingId;

  // --- OBSŁUGA MOTYWU ---
  const [isDarkTheme, setIsDarkTheme] = useState(
    document.body.classList.contains('dark-theme')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // --- LOGIKA FILTRÓW: HAŁAS ---
  const [noiseThreshold, setNoiseThreshold] = useState<number>(
    APP_CONFIG.DEFAULT_NOISE_LIMIT
  );

  // --- LOGIKA FILTRÓW: EDUKACJA ---
  const [eduTypes, setEduTypes] = useState<string[]>([]);
  const [eduRadius, setEduRadius] = useState<number>(
    APP_CONFIG.DEFAULT_EDU_RADIUS
  );

  // --- ZAPAMIĘTYWANIE WARSTW (localStorage) ---
  const [showSafetyLayer, setShowSafetyLayer] = useState<boolean>(() => {
    const savedLayer = localStorage.getItem('map_show_safety_layer');
    return savedLayer !== null ? JSON.parse(savedLayer) : true;
  });

  useEffect(() => {
    localStorage.setItem(
      'map_show_safety_layer',
      JSON.stringify(showSafetyLayer)
    );
  }, [showSafetyLayer]);

  const [showNoiseLayer, setShowNoiseLayer] = useState<boolean>(false);

  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // --- HELPER DO FILTRÓW ---
  const isDistrictVisible = (wskaznik?: number) => {
    if (wskaznik === undefined) return true;
    return wskaznik <= safetyThreshold;
  };

  // Filtry parametrów mieszkania z panelu - wysyłane do API w useMapData
  const [apartmentFilters, setApartmentFilters] = useState<ApartmentFilters>(
    DEFAULT_APARTMENT_FILTERS
  );

  const {
    safetyData,
    geoJsonData,
    buildings,
    educationData,
    safetyRange,
    initialSafetyThreshold,
    isLoadingBuildings,
  } = useMapData(eduTypes, eduRadius, apartmentFilters);

  const [safetyOverride, setSafetyOverride] = useState<number | null>(null);
  const safetyThreshold = safetyOverride ?? initialSafetyThreshold;
  const setSafetyThreshold = (action: number | ((prev: number) => number)) => {
    setSafetyOverride((prev) => {
      const current = prev ?? initialSafetyThreshold;
      return typeof action === 'function' ? action(current) : action;
    });
  };

  const { filteredBuildings, educationDetails, visibleEducationFacilities } =
    useMapFilters({
      buildings,
      educationData,
      safetyData,
      safetyThreshold,
      noiseThreshold,
      eduTypes,
      eduRadius,
      hoveredBuildingId: focusedBuildingId,
    });

  // Wszystkie dzielnice do wyszukiwarki w filtrach (z warstwy mapy, nie z wyników)
  const districtNames = useMemo(
    () =>
      ((geoJsonData?.features ?? []) as GeoJSON.Feature[])
        .map((f) => f.properties?.name as string | undefined)
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, 'pl')),
    [geoJsonData]
  );

  const activeBuilding = filteredBuildings.find(
    (b) => b.id === focusedBuildingId
  );
  const selectedBuilding = filteredBuildings.find(
    (b) => b.id === selectedBuildingId
  );

  // Filtry z chatu (zapisane w kontekście) - stosowane po odpowiedzi chatu
  // i ponownie po powrocie na mapę z innej strony
  useEffect(() => {
    if (!chatFilters) return;
    if (chatFilters.safety_threshold !== undefined)
      setSafetyThreshold(chatFilters.safety_threshold);
    if (chatFilters.noise_threshold !== undefined)
      setNoiseThreshold(chatFilters.noise_threshold);
    if (chatFilters.edu_types !== undefined) setEduTypes(chatFilters.edu_types);
    if (chatFilters.edu_radius !== undefined)
      setEduRadius(chatFilters.edu_radius);
    // settery z useState są stabilne; setSafetyThreshold to wrapper na setSafetyOverride
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFilters]);

  type FeatureLayer = L.Path & { feature?: GeoJSON.Feature };

  // --- STYLE GEOJSON (Generowanie kolorów i ukrywanie dzielnic poza limitem) ---
  const geoJsonStyle = (feature?: GeoJSON.Feature) => {
    const props = feature?.properties ?? {};
    const rawName =
      (props['name'] as string | undefined) ||
      (props['nazwa'] as string | undefined) ||
      '';
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    // LOGIKA ZNIKANIA:
    // Jeśli mamy dane, ale są one GORSZE (większe) niż to, co ustawił użytkownik na suwaku:
    if (wskaznik !== undefined && wskaznik > safetyThreshold) {
      return {
        fillOpacity: 0, // Pełna przezroczystość wypełnienia
        opacity: 0, // Pełna przezroczystość linii (granic)
        weight: 0, // Brak grubości linii
        interactive: false, // Wyłączamy interakcję (dymki nie będą wyskakiwać na pustym polu)
      };
    }

    // Standardowy styl dla pasujących dzielnic
    return {
      fillColor: getColor(wskaznik),
      weight: 1.5,
      opacity: 1,
      color: '#333333',
      dashArray: '',
      // Jeśli brak danych, dajemy trochę mniejsze krycie, a jak są dane to standardowe
      fillOpacity: wskaznik === undefined ? 0.3 : 0.6,
    };
  };

  const highlightFeature = (e: L.LeafletMouseEvent) => {
    const layer = e.target as FeatureLayer;
    const props = layer.feature?.properties ?? {};
    const rawName =
      (props['name'] as string | undefined) ||
      (props['nazwa'] as string | undefined) ||
      '';
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    // Jeśli dzielnica nie spełnia kryteriów bezpieczeństwa (jest ukryta), zablokuj efekt najechania
    if (!isDistrictVisible(wskaznik)) {
      return;
    }

    layer.setStyle({ weight: 3, color: '#111111', fillOpacity: 0.75 });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  };

  const resetHighlight = (e: L.LeafletMouseEvent) => {
    geoJsonRef.current?.resetStyle(e.target as L.Layer);
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties ?? {};
    const rawName =
      (props['name'] as string | undefined) ||
      (props['nazwa'] as string | undefined) ||
      '';
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    layer.on({ mouseover: highlightFeature, mouseout: resetHighlight });

    // Blokujemy tooltipy dla dzielnic odfiltrowanych przez suwak bezpieczeństwa
    if (!isDistrictVisible(wskaznik)) return;

    if (wskaznik !== undefined) {
      layer.bindTooltip(
        `<div style="text-align: center; font-family: sans-serif;">
          <b style="font-size:14px;">${rawName}</b><br/>
          <span style="font-size:11px; color:#555; text-transform:uppercase;">Bezpieczeństwo</span><br/>
          <b style="color: ${getTextColor(wskaznik)}">${getSafetyLabel(wskaznik)}</b><br/>
          <small>(${wskaznik.toFixed(1)} zgłoszeń/1k)</small>
        </div>`,
        { sticky: true }
      );
    } else {
      layer.bindTooltip(`<b>${rawName}</b><br/>Brak danych`, { sticky: true });
    }
  };

  return (
    <div className={styles.mapWrapper}>
      <div className={styles.filterPanel}>
        <div className={styles.filterHeader}>Warstwy</div>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={showSafetyLayer}
            onChange={(e) => setShowSafetyLayer(e.target.checked)}
            className={styles.filterCheckbox}
          />
          Mapa Bezpieczeństwa
        </label>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={showNoiseLayer}
            onChange={(e) => setShowNoiseLayer(e.target.checked)}
            className={styles.filterCheckbox}
          />
          Mapa Hałasu
        </label>
      </div>

      <MapContainer
        center={currentCity.center}
        zoom={12}
        className={styles.mapContainer}
      >
        <FixMapSize />
        <MapController center={currentCity.center} />
        <FocusSelectedBuilding
          lat={selectedBuilding?.lat ?? null}
          lng={selectedBuilding?.lng ?? null}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {showSafetyLayer &&
          geoJsonData &&
          Object.keys(safetyData).length > 0 && (
            <GeoJSON
              key={`gdansk-safety-layer-${safetyThreshold}`}
              data={geoJsonData}
              style={geoJsonStyle}
              onEachFeature={onEachFeature}
              ref={geoJsonRef}
            />
          )}

        {/* --- MAPA HAŁASU (LOKALNY VECTOR GRID) --- */}
        <VectorNoiseLayer showLayer={showNoiseLayer} />

        {/* WARSTWA EDUKACJI: Promień wyszukiwania placówek */}
        {activeBuilding && eduTypes.length > 0 && (
          <Circle
            center={[activeBuilding.lat, activeBuilding.lng]}
            radius={eduRadius * 1000} // radius w Leaflet jest w metrach, dlatego * 1000
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.05,
              weight: 1.5,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* WARSTWA EDUKACJI: Punkty placówek w zasięgu okręgu */}
        {visibleEducationFacilities.map((facility, idx) => (
          <Marker
            key={`edu-${idx}-${facility.lat}-${facility.lng}`}
            position={[facility.lat, facility.lng]}
            icon={educationMarkerIcon}
            zIndexOffset={1500}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
              <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
                <strong
                  style={{
                    fontSize: '13px',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  {facility.name
                    ? facility.name
                    : `${facility.education_type} (niezidentyfikowana)`}
                </strong>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#666',
                    textTransform: 'uppercase',
                  }}
                >
                  {facility.education_type} •{' '}
                  {(facility.currentDistance * 1000).toFixed(0)}m
                </span>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* WARSTWA MIESZKAŃ: Znaczniki dostępnych nieruchomości */}
        <ClusteredBuildings
          buildings={filteredBuildings}
          hoveredBuildingId={hoveredBuildingId}
          setHoveredBuildingId={setHoveredBuildingId}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={setSelectedBuildingId}
          isDarkTheme={isDarkTheme}
        />
      </MapContainer>

      <ChatWidget initialMessage={initialChatQuery} />

      {/* --- PRZEKAZUJEMY DANE DO SIDEBARA --- */}
      <RightSidePanel
        cityName={currentCity.name}
        buildings={filteredBuildings}
        safetyThreshold={safetyThreshold}
        setSafetyThreshold={setSafetyThreshold}
        safetyMin={safetyRange.min}
        safetyMax={safetyRange.max}
        noiseThreshold={noiseThreshold}
        setNoiseThreshold={setNoiseThreshold}
        hoveredBuildingId={hoveredBuildingId}
        setHoveredBuildingId={setHoveredBuildingId}
        selectedBuildingId={selectedBuildingId}
        setSelectedBuildingId={setSelectedBuildingId}
        eduTypes={eduTypes}
        setEduTypes={setEduTypes}
        eduRadius={eduRadius}
        setEduRadius={setEduRadius}
        educationDetails={educationDetails}
        educationData={educationData}
        getDistanceInKm={getDistanceInKm}
        isLoadingBuildings={isLoadingBuildings}
        safetyData={safetyData}
        apartmentFilters={apartmentFilters}
        setApartmentFilters={setApartmentFilters}
        districtNames={districtNames}
      />
    </div>
  );
}

export default Map;

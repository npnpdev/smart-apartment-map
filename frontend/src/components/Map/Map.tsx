// Zewnętrzne biblioteki
import { useEffect, useState, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  GeoJSON, 
  Circle, 
  Tooltip 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

// Konfiguracja
import { APP_CONFIG } from '../../constants';

// Globalny kontekst i typy
import { useAppContext } from '../../context/AppContext.tsx'; 

// Własne komponenty (Podkomponenty mapy i UI)
import FixMapSize from './FixMapSize';
import VectorNoiseLayer from './VectorNoiseLayer';
import ClusteredBuildings from './ClusteredBuildings';
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
  getTextColor 
} from './mapStyles';

// Style CSS
import styles from './Map.module.css';

import ChatWidget from '../ChatWidget/ChatWidget';

function Map() {
  const { currentCity } = useAppContext();

  // --- STAN HOVERA MIESZKAŃ ---
  const [hoveredBuildingId, setHoveredBuildingId] = useState<number | string | null>(null);

  // --- OBSŁUGA MOTYWU ---
  const [isDarkTheme, setIsDarkTheme] = useState(document.body.classList.contains('dark-theme'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // --- LOGIKA FILTRÓW: HAŁAS ---
  const [noiseThreshold, setNoiseThreshold] = useState<number>(APP_CONFIG.DEFAULT_NOISE_LIMIT);

  // --- LOGIKA FILTRÓW: EDUKACJA ---
  const [eduTypes, setEduTypes] = useState<string[]>([]);
  const [eduRadius, setEduRadius] = useState<number>(APP_CONFIG.DEFAULT_EDU_RADIUS);

  // --- ZAPAMIĘTYWANIE WARSTW (localStorage) ---
  const [showSafetyLayer, setShowSafetyLayer] = useState<boolean>(() => {
    const savedLayer = localStorage.getItem('map_show_safety_layer');
    return savedLayer !== null ? JSON.parse(savedLayer) : true;
  });

  useEffect(() => {
    localStorage.setItem('map_show_safety_layer', JSON.stringify(showSafetyLayer));
  }, [showSafetyLayer]);

  const [showNoiseLayer, setShowNoiseLayer] = useState<boolean>(false);

  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // --- HELPER DO FILTRÓW ---
  const isDistrictVisible = (wskaznik?: number) => {
    if (wskaznik === undefined) return true;
    return wskaznik <= safetyThreshold;
  };

  const {
    safetyData,
    geoJsonData,
    buildings,
    educationData,
    safetyRange,
    initialSafetyThreshold,
    isLoadingBuildings
  } = useMapData(eduTypes, eduRadius);

  const [safetyOverride, setSafetyOverride] = useState<number | null>(null);
  const safetyThreshold = safetyOverride ?? initialSafetyThreshold;
  const setSafetyThreshold = (action: number | ((prev: number) => number)) => {
    setSafetyOverride(prev => {
      const current = prev ?? initialSafetyThreshold;
      return typeof action === 'function' ? action(current) : action;
    });
  };

  const {
    filteredBuildings,
    educationDetails,
    visibleEducationFacilities
  } = useMapFilters({
    buildings,
    educationData,
    safetyData,
    safetyThreshold,
    noiseThreshold,
    eduTypes,
    eduRadius,
    hoveredBuildingId
  });

  const activeBuilding = filteredBuildings.find(b => b.id === hoveredBuildingId);

  const applyFiltersFromChat = (filters: {
    safety_threshold?: number;
    noise_threshold?: number;
    edu_types?: string[];
    edu_radius?: number;
  }) => {
    if (filters.safety_threshold !== undefined) setSafetyThreshold(filters.safety_threshold);
    if (filters.noise_threshold !== undefined) setNoiseThreshold(filters.noise_threshold);
    if (filters.edu_types !== undefined) setEduTypes(filters.edu_types);
    if (filters.edu_radius !== undefined) setEduRadius(filters.edu_radius);
  };

  type FeatureLayer = L.Path & { feature?: GeoJSON.Feature };

  // --- STYLE GEOJSON (Generowanie kolorów i ukrywanie dzielnic poza limitem) ---
  const geoJsonStyle = (feature?: GeoJSON.Feature) => {
    const props = feature?.properties ?? {};
    const rawName = (props['name'] as string | undefined) || (props['nazwa'] as string | undefined) || '';
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    // LOGIKA ZNIKANIA:
    // Jeśli mamy dane, ale są one GORSZE (większe) niż to, co ustawił użytkownik na suwaku:
    if (wskaznik !== undefined && wskaznik > safetyThreshold) {
      return {
        fillOpacity: 0, // Pełna przezroczystość wypełnienia
        opacity: 0,     // Pełna przezroczystość linii (granic)
        weight: 0,      // Brak grubości linii
        interactive: false // Wyłączamy interakcję (dymki nie będą wyskakiwać na pustym polu)
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
    const rawName = (props['name'] as string | undefined) || (props['nazwa'] as string | undefined) || '';
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
    const rawName = (props['name'] as string | undefined) || (props['nazwa'] as string | undefined) || '';
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

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {showSafetyLayer && geoJsonData && Object.keys(safetyData).length > 0 && (
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
              dashArray: '5, 5'
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
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '2px' }}>
                  {facility.name ? facility.name : `${facility.education_type} (niezidentyfikowana)`}
                </strong>
                <span style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase' }}>
                  {facility.education_type} • {(facility.currentDistance * 1000).toFixed(0)}m
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
          isDarkTheme={isDarkTheme}
        />
      </MapContainer>

      <ChatWidget onFiltersReceived={applyFiltersFromChat} />

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
        eduTypes={eduTypes}
        setEduTypes={setEduTypes}
        eduRadius={eduRadius}
        setEduRadius={setEduRadius}
        educationDetails={educationDetails}
        educationData={educationData}
        getDistanceInKm={getDistanceInKm}
        isLoadingBuildings={isLoadingBuildings}
      />
    </div>
  );
}

export default Map;
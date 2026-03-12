import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  Popup,
  GeoJSON,
  Circle,      
  Tooltip      
} from 'react-leaflet';
import L, { divIcon, type LatLngExpression } from 'leaflet';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext.tsx'; 
import MapController from '../MapController.tsx';
import RightSidePanel from '../RightSidePanel/RightSidePanel.tsx';
import styles from './Map.module.css';

function FixMapSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [map]);
  return null;
}

// --- FUNKCJA POMOCNICZA ---
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Promień Ziemi w km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Map() {
  const { currentCity } = useAppContext();

  // --- DANE ---
  const[safetyData, setSafetyData] = useState<Record<string, number>>({});
  const[geoJsonData, setGeoJsonData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);

  const [educationData, setEducationData] = useState<any[]>([]);

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


  // --- NOWA LOGIKA FILTRÓW (Suwak) ---
  // 1. Zakres danych (Min i Max przestępczości w mieście) - obliczane z API
  const [safetyRange, setSafetyRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  
  // 2. Aktualnie wybrany próg (domyślnie ustawiamy wysoko, żeby pokazać wszystko)
  const[safetyThreshold, setSafetyThreshold] = useState<number>(1000); 

  // --- LOGIKA FILTRÓW: EDUKACJA ---
  const[eduTypes, setEduTypes] = useState<string[]>([]);
  const[eduRadius, setEduRadius] = useState<number>(5);

  // --- ZAPAMIĘTYWANIE WARSTW (localStorage) ---
  const [showSafetyLayer, setShowSafetyLayer] = useState<boolean>(() => {
    const savedLayer = localStorage.getItem('map_show_safety_layer');
    return savedLayer !== null ? JSON.parse(savedLayer) : true;
  });

  useEffect(() => {
    localStorage.setItem('map_show_safety_layer', JSON.stringify(showSafetyLayer));
  }, [showSafetyLayer]);
  
  const geoJsonRef = useRef<any>(null);

    // --- HELPER DO FILTRÓW ---
  const isDistrictVisible = (wskaznik?: number) => {
    if (wskaznik === undefined) return true;
    return wskaznik <= safetyThreshold;
  };


  // --- NORMALIZACJA NAZW ---
  const normalizeName = (name: string) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/-/g, ' ')
      .replace(/–/g, ' ')
      .replace(/\s+/g, ' ')
      .replace('św.', 'święty')
      .trim();
  };

  // --- POBIERANIE DANYCH ---
  useEffect(() => {
    // 1. API Bezpieczeństwa + Obliczanie Min/Max
    fetch('http://localhost:8000/api/safety/')
      .then((res) => res.json())
      .then((data) => {
        const dict: Record<string, number> = {};
        const values: number[] =[]; // Tablica do znalezienia skali suwaka

        data.forEach((item: any) => {
          const cleanName = normalizeName(item.dzielnica);
          const val = parseFloat(item.wskaznik_przestepstw);
          
          if (!isNaN(val)) {
            dict[cleanName] = val;
            values.push(val);
          }
        });
        
        setSafetyData(dict);

        // Ustawiamy zakres suwaka na podstawie prawdziwych danych
        if (values.length > 0) {
          const minVal = Math.floor(Math.min(...values));
          const maxVal = Math.ceil(Math.max(...values));
          setSafetyRange({ min: minVal, max: maxVal });
          // Na start ustawiamy próg na max + 1 (pokaż wszystko)
          setSafetyThreshold(maxVal + 1); 
        }
      })
      .catch((err) => console.error('Błąd API Bezpieczeństwo:', err));

    // 2. GeoJSON
    fetch('/data/gdansk_dzielnice.geojson')
      .then((res) => res.json())
      .then((data) => {
        const onlyPolygons = data.features.filter(
          (f: any) =>
            f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );
        setGeoJsonData({ ...data, features: onlyPolygons });
      })
      .catch((err) => console.error('Błąd GeoJSON:', err));

    // 3. Mieszkania
    fetch('http://localhost:8000/api/apartments/')
      .then((res) => res.json())
      .then((data) => {
        setBuildings(data);
      })
      .catch((err) => console.error('Błąd API Mieszkań:', err));

    // 4. Edukacja
    fetch('http://localhost:8000/api/education/')
      .then((res) => res.json())
      .then((data) => {
        setEducationData(data);
      })
      .catch((err) => console.error('Błąd API Edukacji:', err));
  },[]);

  // --- LOGIKA FILTROWANIA (ROZBUDOWANA) ---
  const filteredBuildings = buildings.filter((building) => {
    // 1. Filtr Bezpieczeństwa
    const districtName = normalizeName(building.district);
    const crimeRate = safetyData[districtName];
    if (crimeRate !== undefined && crimeRate > safetyThreshold) return false;

    // 2. Filtr Edukacji (Zaktualizowany)
    if (eduTypes.length > 0) {
      // Dla TEGO konkretnego budynku, sprawdzamy czy w pobliżu są zaznaczone typy placówek
      // Musimy spełnić warunek dla KAŻDEGO z zaznaczonych typów (np. chcesz i Przedszkole i Podstawową)
      // lub tylko dla jednego? Założenie: jeśli ktoś zaznaczy Przedszkola i Podstawowe, 
      // szuka mieszkania, które ma OBA w promieniu.
      
      const hasAllSelectedTypes = eduTypes.every(selectedType => {
        // Szukamy czy jest JAKAKOLWIEK placówka danego typu blisko tego budynku
        return educationData.some(facility => {
          // Używamy nowego pola z API
          if (facility.education_type !== selectedType) return false;
          
          const distance = getDistanceInKm(building.lat, building.lng, facility.lat, facility.lng);
          return distance <= eduRadius;
        });
      });
      
      if (!hasAllSelectedTypes) return false;
    }

    return true;
  });

    // --- OBLICZANIE LICZBY PLACÓWEK DLA FILTRÓW ---
  // Oblicza, ile dostępnych placówek każdego typu znajduje się w zasięgu "eduRadius" 
  const educationDetails = useMemo(() => {
    // Przygotowujemy strukturę przechowującą i liczbę, i nazwy
    const details: Record<string, { count: number; names: string[] }> = {
      "Przedszkola": { count: 0, names: [] },
      "Podstawowe": { count: 0, names: [] },
      "Średnie": { count: 0, names: [] },
      "Uczelnie": { count: 0, names: [] },
      "Inne": { count: 0, names: [] }
    };

    if (buildings.length === 0 || educationData.length === 0) return details;

    const countedFacilities = new Set<number>();

    educationData.forEach((facility, index) => {
      if (!details.hasOwnProperty(facility.education_type)) return;

      const isNearAnyBuilding = filteredBuildings.some(building => {
        const dist = getDistanceInKm(building.lat, building.lng, facility.lat, facility.lng);
        return dist <= eduRadius;
      });

      if (isNearAnyBuilding && !countedFacilities.has(index)) {
        countedFacilities.add(index);
        details[facility.education_type].count += 1;
        
        // Czasami w OSM placówka nie ma wprowadzonej nazwy, zabezpieczamy to:
        const facilityName = facility.name || `Placówka bez nazwy`;
        details[facility.education_type].names.push(facilityName);
      }
    });

    return details;
  }, [filteredBuildings, educationData, eduRadius]);

    // --- PLACÓWKI EDUKACYJNE DO WYŚWIETLENIA (Tylko dla aktywnego budynku) ---
  const visibleEducationFacilities = useMemo(() => {
    // Jeśli nie najeżdżamy na żaden dom, lub nie ma włączonych filtrów edukacji - nie pokazuj nic
    if (!hoveredBuildingId || eduTypes.length === 0) return [];

    const activeBuilding = filteredBuildings.find(b => b.id === hoveredBuildingId);
    if (!activeBuilding) return [];

    // Szukamy wszystkich placówek, które pasują do wybranych filtrów ORAZ są w zasięgu promienia
    return educationData.filter(facility => {
      if (!eduTypes.includes(facility.education_type)) return false;
      
      const dist = getDistanceInKm(activeBuilding.lat, activeBuilding.lng, facility.lat, facility.lng);
      // Przekazujemy dystans do obiektu, żeby ew. wyświetlić go w tooltipie
      if (dist <= eduRadius) {
        facility.currentDistance = dist;
        return true;
      }
      return false;
    });
  }, [hoveredBuildingId, filteredBuildings, educationData, eduTypes, eduRadius]);

  const activeBuilding = filteredBuildings.find(b => b.id === hoveredBuildingId);

  // --- MARKERY I STYLE (Bez zmian) ---
  const buildingMarkerIcon = useMemo(
    () =>
      divIcon({
        className: '',
        html: `
          <div class="${styles.markerWrap}">
            <div class="${styles.marker}">
              <svg class="${styles.markerHouse}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 9.5V19H17.5V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 19V14H14V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="${styles.markerDot}"></div>
          </div>
        `,
        iconSize:[42, 48],
        iconAnchor: [21, 48],
        popupAnchor:[0, -44],
      }),[]
  );

    // --- IKONA PODŚWIETLONA (Większa) ---
  const buildingMarkerIconHovered = useMemo(
    () => {
      // Sztywne hexy żeby oszukać Leafleta: tło i ikona/ogon
      const fgColor = isDarkTheme ? '#111111' : '#f3f3f1'; 
      const bgColor = isDarkTheme ? '#f3f3f1' : '#181716'; 
      
      return divIcon({
        className: '',
        html: `
          <div style="width: 42px; height: 42px; position: relative; transform: scale(1.15); transition: transform 0.2s; z-index: 2000;">
            <div style="width: 42px; height: 42px; border-radius: 16px; background-color: ${bgColor} !important; border: 1px solid ${bgColor} !important; box-shadow: 0 14px 30px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: ${fgColor} !important;">
                <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 9.5V19H17.5V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 19V14H14V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div style="position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); width: 10px; height: 10px; border-radius: 999px; background-color: ${fgColor} !important; border: 2px solid ${bgColor} !important; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize:[42, 48],
        iconAnchor: [21, 48],
        popupAnchor:[0, -44],
      });
    }, [isDarkTheme] 
  );

    // --- IKONA DLA PLACÓWEK EDUKACYJNYCH (Mała kropeczka) ---
  const educationMarkerIcon = useMemo(
    () => {
      // Jasno-niebieski kolor odróżniający się od domów i mapy bezpieczeństwa
      const bgColor = '#3b82f6'; 
      const borderColor = '#ffffff';

      return divIcon({
        className: '',
        html: `
          <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${bgColor}; border: 2px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7], // Środek kropeczki
      });
    }, []
  );

  const getSafetyLabel = (val: number) => {
    if (val < 15) return 'Bardzo Wysokie';
    if (val < 30) return 'Wysokie';
    if (val < 50) return 'Średnie';
    return 'Niskie';
  };

  const getColor = (wskaznik?: number) => {
    if (wskaznik === undefined || wskaznik === null) return '#ffffff';
    if (wskaznik >= 60) return '#d73027';
    if (wskaznik >= 45) return '#fc8d59';
    if (wskaznik >= 30) return '#fee08b';
    if (wskaznik >= 20) return '#ffffbf';
    if (wskaznik >= 15) return '#d9ef8b';
    if (wskaznik >= 10) return '#91cf60';
    return '#1a9850';
  };

  const getTextColor = (wskaznik?: number) => {
  if (wskaznik === undefined || wskaznik === null) return '#333333';
  if (wskaznik >= 60) return '#b2182b'; // Ciemny czerwony
  if (wskaznik >= 45) return '#d6604d'; // Ciemniejszy pomarańczowy
  if (wskaznik >= 30) return '#b8860b'; // Zgaszony, ciemny żółto-musztardowy
  if (wskaznik >= 20) return '#8c7d00'; // Oliwkowy (zamiast bardzo jasnego żółtego)
  if (wskaznik >= 15) return '#4d9221'; // Ciemny, soczysty zielony
  if (wskaznik >= 10) return '#276419'; // Jeszcze ciemniejszy zielony
  return '#00441b'; // Najciemniejszy zielony
  };

  // --- ZMODYFIKOWANY STYL (Reaguje na suwak) ---
  const geoJsonStyle = (feature: any) => {
    const rawName = feature.properties?.name || feature.properties?.nazwa;
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

    const highlightFeature = (e: any) => {
    const layer = e.target;
    const rawName = layer.feature?.properties?.name || layer.feature?.properties?.nazwa;
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    // TUTAJ JEST MAGIA: Jeśli dzielnica jest ukryta filtrem, ignoruj hover
    if (!isDistrictVisible(wskaznik)) {
      return;
    }

    layer.setStyle({ weight: 3, color: '#111111', fillOpacity: 0.75 });
    
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  };


  const resetHighlight = (e: any) => {
    if (geoJsonRef.current) {
      geoJsonRef.current.resetStyle(e.target);
    }
  };

  const onEachFeature = (feature: any, layer: any) => {
    const rawName = feature.properties?.name || feature.properties?.nazwa;
    const cleanName = normalizeName(rawName);
    const wskaznik = safetyData[cleanName];

    layer.on({ mouseover: highlightFeature, mouseout: resetHighlight });

    // Jeśli ukryta, w ogóle nie doczepiaj dymka (tooltipa)
    if (!isDistrictVisible(wskaznik)) {
      return;
    }


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

        {/* --- NOWE: OKRĄG PROMIENIA DLA EDUKACJI --- */}
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

        {/* --- NOWE: MAŁE KROPECZKI PLACÓWEK EDUKACYJNYCH --- */}
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

        {/* --- ZMIENIONE Z-INDEX DLA MIESZKAŃ --- */}
        {filteredBuildings.map((building) => (
          <Marker
            key={building.id}
            position={[building.lat, building.lng]}
            icon={hoveredBuildingId === building.id ? buildingMarkerIconHovered : buildingMarkerIcon}
            zIndexOffset={hoveredBuildingId === building.id ? 2500 : 500} // Z-index zmieniony na 2500/500 żeby mieszkania nad którymi NIE najeżdżamy nie zasłaniały pinezek edukacji
            eventHandlers={{
              mouseover: () => setHoveredBuildingId(building.id),
              mouseout: () => setHoveredBuildingId(null),
            }}
          >
            <Popup>

              <div>
                <strong>{building.name}</strong><br />
                {building.district}<br />
                Cena: {building.price} zł
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* --- PRZEKAZUJEMY DANE DO SIDEBARA --- */}
        <RightSidePanel
        cityName={currentCity.name}
        buildings={filteredBuildings}
        safetyThreshold={safetyThreshold}
        setSafetyThreshold={setSafetyThreshold}
        safetyMin={safetyRange.min}
        safetyMax={safetyRange.max}
        hoveredBuildingId={hoveredBuildingId}
        setHoveredBuildingId={setHoveredBuildingId}
        eduTypes={eduTypes}
        setEduTypes={setEduTypes}
        eduRadius={eduRadius}
        setEduRadius={setEduRadius}
        educationDetails={educationDetails}
        educationData={educationData}
        getDistanceInKm={getDistanceInKm}
      />
    </div>
  );
}
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  Popup,
  GeoJSON,
} from 'react-leaflet';
import L, { divIcon, type LatLngExpression } from 'leaflet';
import { useEffect, useMemo, useState, useRef } from 'react';
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

const cities: { name: string; center: LatLngExpression }[] = [
  { name: 'Gdańsk', center:[54.352, 18.6466] },
  { name: 'Gdynia', center:[54.5189, 18.5305] },
  { name: 'Sopot', center: [54.4418, 18.5601] },
  { name: 'OlsztynKOCHAM', center:[53.7784, 20.4801] },
];

export default function Map() {
  const[selectedCityIdx, setSelectedCityIdx] = useState(0);

  // --- DANE ---
  const[safetyData, setSafetyData] = useState<Record<string, number>>({});
  const[geoJsonData, setGeoJsonData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);

  // --- NOWA LOGIKA FILTRÓW (Suwak) ---
  // 1. Zakres danych (Min i Max przestępczości w mieście) - obliczane z API
  const [safetyRange, setSafetyRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  
  // 2. Aktualnie wybrany próg (domyślnie ustawiamy wysoko, żeby pokazać wszystko)
  const[safetyThreshold, setSafetyThreshold] = useState<number>(1000); 

  // --- ZAPAMIĘTYWANIE WARSTW (localStorage) ---
  const [showSafetyLayer, setShowSafetyLayer] = useState<boolean>(() => {
    const savedLayer = localStorage.getItem('map_show_safety_layer');
    return savedLayer !== null ? JSON.parse(savedLayer) : true;
  });

  useEffect(() => {
    localStorage.setItem('map_show_safety_layer', JSON.stringify(showSafetyLayer));
  }, [showSafetyLayer]);
  
  const geoJsonRef = useRef<any>(null);

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
  },[]);

  // --- LOGIKA FILTROWANIA ---
  const filteredBuildings = buildings.filter((building) => {
    const districtName = normalizeName(building.district);
    const crimeRate = safetyData[districtName];

    // Jeśli nie mamy danych o dzielnicy, na razie przepuszczamy
    if (crimeRate === undefined) return true;

    // NOWOŚĆ: Porównujemy z wartością suwaka
    return crimeRate <= safetyThreshold;
  });

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

  const highlightFeature = (e: any) => { /* ... bez zmian ... */
    const layer = e.target;
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

    if (wskaznik !== undefined) {
      layer.bindTooltip(
        `<div style="text-align: center; font-family: sans-serif;">
          <b style="font-size:14px;">${rawName}</b><br/>
          <span style="font-size:11px; color:#555; text-transform:uppercase;">Bezpieczeństwo</span><br/>
          <b style="color: ${getColor(wskaznik)}">${getSafetyLabel(wskaznik)}</b><br/>
          <small>(${wskaznik.toFixed(1)} zgłoszeń/1k)</small>
        </div>`,
        { sticky: true }
      );
    } else {
      layer.bindTooltip(`<b>${rawName}</b><br/>Brak danych`, { sticky: true });
    }
  };

  function onChangeCity(): void {
    setSelectedCityIdx((prev) => (prev < cities.length - 1 ? prev + 1 : 0));
  }

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
        center={cities[0].center}
        zoom={12}
        className={styles.mapContainer}
      >
        <FixMapSize />
        <MapController center={cities[selectedCityIdx].center} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {showSafetyLayer && geoJsonData && Object.keys(safetyData).length > 0 && (
          <GeoJSON
            key="gdansk-safety-layer"
            data={geoJsonData}
            style={geoJsonStyle}
            onEachFeature={onEachFeature}
            ref={geoJsonRef}
          />
        )}

        {filteredBuildings.map((building) => (
          <Marker
            key={building.id}
            position={[building.lat, building.lng]}
            icon={buildingMarkerIcon}
            zIndexOffset={1000}
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
      {/* Tu będzie błąd TypeScripta dopóki nie zrobimy Kroku 2 - to normalne! */}
      <RightSidePanel
        cityName={cities[selectedCityIdx].name}
        onChangeCity={onChangeCity}
        buildings={filteredBuildings}
        // Nowe propsy:
        safetyThreshold={safetyThreshold}
        setSafetyThreshold={setSafetyThreshold}
        safetyMin={safetyRange.min}
        safetyMax={safetyRange.max}
      />
    </div>
  );
}
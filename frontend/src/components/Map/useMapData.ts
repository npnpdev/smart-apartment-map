import { useState, useEffect } from 'react';
import { normalizeName } from './utils';
import { APP_CONFIG } from '../../constants';

const API_BASE = 'http://localhost:8000';

interface MapDataResult {
  safetyData: Record<string, number>;
  geoJsonData: any;
  buildings: any[];
  educationData: any[];
  safetyRange: { min: number; max: number };
  initialSafetyThreshold: number;
  isLoadingBuildings: boolean;
}

export function useMapData(
  eduTypes: string[] = [],
  eduRadius: number = APP_CONFIG.DEFAULT_EDU_RADIUS
): MapDataResult {
  const [safetyData, setSafetyData] = useState<Record<string, number>>({});
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [educationData, setEducationData] = useState<any[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(true);

  const [safetyRange, setSafetyRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [initialSafetyThreshold, setInitialSafetyThreshold] = useState<number>(1000);

  useEffect(() => {
    fetch(`${API_BASE}/api/safety/`)
      .then((res) => res.json())
      .then((data) => {
        const dict: Record<string, number> = {};
        const values: number[] = [];

        data.forEach((item: any) => {
          const cleanName = normalizeName(item.dzielnica);
          const val = parseFloat(item.wskaznik_przestepstw);

          if (!isNaN(val)) {
            dict[cleanName] = val;
            values.push(val);
          }
        });

        setSafetyData(dict);

        if (values.length > 0) {
          const minVal = Math.floor(Math.min(...values));
          const maxVal = Math.ceil(Math.max(...values));
          setSafetyRange({ min: minVal, max: maxVal });
          setInitialSafetyThreshold(maxVal + 1);
        }
      })
      .catch((err) => console.error('Błąd API Bezpieczeństwo:', err));

    fetch('/data/gdansk_dzielnice.geojson')
      .then((res) => res.json())
      .then((data) => {
        const onlyPolygons = data.features.filter(
          (f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );
        setGeoJsonData({ ...data, features: onlyPolygons });
      })
      .catch((err) => console.error('Błąd GeoJSON:', err));

    fetch(`${API_BASE}/api/education/`)
      .then((res) => res.json())
      .then((data) => {
        setEducationData(data);
      })
      .catch((err) => console.error('Błąd API Edukacji:', err));
  }, []);

  const eduTypesKey = eduTypes.join(',');

  useEffect(() => {
    const controller = new AbortController();

    const opoznienie = setTimeout(() => {
      setIsLoadingBuildings(true);
      const params = new URLSearchParams();
      if (eduTypesKey) {
        params.set('edu_types', eduTypesKey);
        params.set('edu_radius', String(eduRadius));
      }
      const query = params.toString();

      fetch(`${API_BASE}/api/apartments/${query ? `?${query}` : ''}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setBuildings(data);
          setIsLoadingBuildings(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('Błąd API Mieszkań:', err);
          setIsLoadingBuildings(false);
        });
    }, APP_CONFIG.FILTER_DEBOUNCE_MS);

    return () => {
      clearTimeout(opoznienie);
      controller.abort();
    };
  }, [eduTypesKey, eduRadius]);

  return {
    safetyData,
    geoJsonData,
    buildings,
    educationData,
    safetyRange,
    initialSafetyThreshold,
    isLoadingBuildings,
  };
}

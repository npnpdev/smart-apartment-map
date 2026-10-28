import { useState, useEffect, useRef } from 'react';
import { normalizeName } from './utils';
import { APP_CONFIG, API_BASE } from '../../constants';
import {
  type ApartmentFilters,
  DEFAULT_APARTMENT_FILTERS,
  apartmentFiltersToParams,
} from '../RightSidePanel/filters/apartmentFilters';

interface MapDataResult {
  safetyData: Record<string, number>;
  safetyRange: { min: number; max: number };
  initialSafetyThreshold: number;
  geoJsonData: any;
  buildings: any[];
  educationData: any[];
  isLoadingBuildings: boolean;
}

export function useSafetyData(showLayer: boolean): {
  safetyData: Record<string, number>;
  safetyRange: { min: number; max: number };
  initialSafetyThreshold: number;
} {
  const [safetyData, setSafetyData] = useState<Record<string, number>>({});
  const [safetyRange, setSafetyRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [initialSafetyThreshold, setInitialSafetyThreshold] = useState<number>(1000);
  const loaded = useRef(false);

  useEffect(() => {
    if (!showLayer || loaded.current) return;
    loaded.current = true;

    fetch(`${API_BASE}/api/safety/`)
      .then((res) => res.json())
      .then((data) => {
        const dict: Record<string, number> = {};
        const values: number[] = [];
        data.forEach((item: any) => {
          const cleanName = normalizeName(item.dzielnica);
          const val = parseFloat(item.wskaznik_przestepstw);
          if (!isNaN(val)) { dict[cleanName] = val; values.push(val); }
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
  }, [showLayer]);

  return { safetyData, safetyRange, initialSafetyThreshold };
}

export function useMapData(
  eduTypes: string[] = [],
  eduRadius: number = APP_CONFIG.DEFAULT_EDU_RADIUS,
  apartmentFilters: ApartmentFilters = DEFAULT_APARTMENT_FILTERS
): MapDataResult {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [educationData, setEducationData] = useState<any[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(true);

  useEffect(() => {
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

    fetch(`${API_BASE}/api/education/`)
      .then((res) => res.json())
      .then((data) => {
        setEducationData(data);
      })
      .catch((err) => console.error('Błąd API Edukacji:', err));
  }, []);

  const eduTypesKey = eduTypes.join(',');

  // Zapytanie budowane poza efektem - efekt reaguje na zmianę tekstu zapytania
  const queryParams = new URLSearchParams();
  if (eduTypesKey) {
    queryParams.set('edu_types', eduTypesKey);
    queryParams.set('edu_radius', String(eduRadius));
  }
  apartmentFiltersToParams(apartmentFilters, queryParams);
  const query = queryParams.toString();

  useEffect(() => {
    const controller = new AbortController();

    const opoznienie = setTimeout(() => {
      setIsLoadingBuildings(true);

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
  }, [query]);

  return {
    safetyData: {},
    safetyRange: { min: 0, max: 100 },
    initialSafetyThreshold: 1000,
    geoJsonData,
    buildings,
    educationData,
    isLoadingBuildings,
  };
}

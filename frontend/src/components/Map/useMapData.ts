import { useState, useEffect } from 'react';
import { normalizeName } from './utils';

// Typy zwracane przez hook, żeby TypeScript wiedział co dostaje Map.tsx
interface MapDataResult {
  safetyData: Record<string, number>;
  geoJsonData: any;
  buildings: any[];
  educationData: any[];
  safetyRange: { min: number; max: number };
  initialSafetyThreshold: number;
}

export function useMapData(): MapDataResult {
  const [safetyData, setSafetyData] = useState<Record<string, number>>({});
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [educationData, setEducationData] = useState<any[]>([]);
  
  // Stany dla zakresów, które wcześniej liczyliśmy w Map.tsx
  const [safetyRange, setSafetyRange] = useState<{ min: number; max: number }>({ min: 0, max: 100 });
  const [initialSafetyThreshold, setInitialSafetyThreshold] = useState<number>(1000);

  useEffect(() => {
    // 1. API Bezpieczeństwa + Obliczanie Min/Max
    fetch('http://localhost:8000/api/safety/')
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

    // 2. GeoJSON
    fetch('/data/gdansk_dzielnice.geojson')
      .then((res) => res.json())
      .then((data) => {
        const onlyPolygons = data.features.filter(
          (f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
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
  }, []);

  // Zwracamy wszystko to, co zebraliśmy, żeby Map.tsx mógł z tego skorzystać
  return {
    safetyData,
    geoJsonData,
    buildings,
    educationData,
    safetyRange,
    initialSafetyThreshold
  };
}

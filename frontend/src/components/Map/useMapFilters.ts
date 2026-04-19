import { useMemo } from 'react';
import { getDistanceInKm, normalizeName } from './utils';

interface UseMapFiltersProps {
  buildings: any[];
  educationData: any[];
  safetyData: Record<string, number>;
  safetyThreshold: number;
  noiseThreshold: number;
  eduTypes: string[];
  eduRadius: number;
  hoveredBuildingId: number | string | null;
}

export function useMapFilters({
  buildings,
  educationData,
  safetyData,
  safetyThreshold,
  noiseThreshold,
  eduTypes,
  eduRadius,
  hoveredBuildingId
}: UseMapFiltersProps) {

  // 1. Filtrowanie budynków
  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      const districtName = normalizeName(building.district);
      const crimeRate = safetyData[districtName];
      if (crimeRate !== undefined && crimeRate > safetyThreshold) return false;

      if (noiseThreshold < 80 && building.noise_db !== undefined && building.noise_db !== null) {
        const noiseStr = String(building.noise_db);
        const match = noiseStr.match(/\d+/); 
        if (match) {
          const buildingNoise = parseInt(match[0], 10);
          if (buildingNoise > noiseThreshold) return false; 
        }
      }

      if (eduTypes.length > 0) {
        const hasAllSelectedTypes = eduTypes.every(selectedType => {
          return educationData.some(facility => {
            if (facility.education_type !== selectedType) return false;
            const distance = getDistanceInKm(building.lat, building.lng, facility.lat, facility.lng);
            return distance <= eduRadius;
          });
        });
        
        if (!hasAllSelectedTypes) return false;
      }

      return true;
    });
  }, [buildings, safetyData, safetyThreshold, noiseThreshold, eduTypes, eduRadius, educationData]);

  // 2. Obliczanie liczby placówek w zasięgu promienia
  const educationDetails = useMemo(() => {
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
        const facilityName = facility.name || `Placówka bez nazwy`;
        details[facility.education_type].names.push(facilityName);
      }
    });

    return details;
  }, [filteredBuildings, educationData, eduRadius, buildings.length]);

  // 3. Widoczne placówki edukacyjne dla najechanego budynku
  const visibleEducationFacilities = useMemo(() => {
    if (!hoveredBuildingId || eduTypes.length === 0) return [];

    const activeBuilding = filteredBuildings.find(b => b.id === hoveredBuildingId);
    if (!activeBuilding) return [];

    return educationData.filter(facility => {
      if (!eduTypes.includes(facility.education_type)) return false;
      
      const dist = getDistanceInKm(activeBuilding.lat, activeBuilding.lng, facility.lat, facility.lng);
      if (dist <= eduRadius) {
        facility.currentDistance = dist;
        return true;
      }
      return false;
    });
  }, [hoveredBuildingId, filteredBuildings, educationData, eduTypes, eduRadius]);

  return {
    filteredBuildings,
    educationDetails,
    visibleEducationFacilities
  };
}

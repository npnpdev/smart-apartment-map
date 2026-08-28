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

      return true;
    });
  }, [buildings, safetyData, safetyThreshold, noiseThreshold]);

  const educationDetails = useMemo(() => {
    const details: Record<string, { count: number; names: string[] }> = {
      "Przedszkola": { count: 0, names: [] },
      "Podstawowe": { count: 0, names: [] },
      "Średnie": { count: 0, names: [] },
      "Uczelnie": { count: 0, names: [] },
      "Inne": { count: 0, names: [] }
    };

    if (filteredBuildings.length === 0 || educationData.length === 0) return details;

    educationData.forEach((facility) => {
      if (!Object.prototype.hasOwnProperty.call(details, facility.education_type)) return;

      const isNearAnyBuilding = filteredBuildings.some(building => {
        const dist = getDistanceInKm(building.lat, building.lng, facility.lat, facility.lng);
        return dist <= eduRadius;
      });

      if (isNearAnyBuilding) {
        details[facility.education_type].count += 1;
        details[facility.education_type].names.push(facility.name || `Placówka bez nazwy`);
      }
    });

    return details;
  }, [filteredBuildings, educationData, eduRadius]);

  const visibleEducationFacilities = useMemo(() => {
    if (!hoveredBuildingId || eduTypes.length === 0) return [];

    const activeBuilding = filteredBuildings.find(b => b.id === hoveredBuildingId);
    if (!activeBuilding) return [];

    return educationData
      .filter(facility => eduTypes.includes(facility.education_type))
      .map(facility => ({
        ...facility,
        currentDistance: getDistanceInKm(
          activeBuilding.lat, activeBuilding.lng, facility.lat, facility.lng
        ),
      }))
      .filter(facility => facility.currentDistance <= eduRadius);
  }, [hoveredBuildingId, filteredBuildings, educationData, eduTypes, eduRadius]);

  return {
    filteredBuildings,
    educationDetails,
    visibleEducationFacilities
  };
}

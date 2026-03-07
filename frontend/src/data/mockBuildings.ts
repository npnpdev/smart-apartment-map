import type { Building } from '../types/building';

export const mockBuildings: Building[] = [
  {
    id: 'building-1',
    name: 'Budynek Oliwa 1',
    district: 'Oliwa',
    address: 'ul. Polanki 12, Gdańsk',
    lat: 54.4099,
    lng: 18.5588,
    overallScore: 82,
    priceScore: 70,
    noiseScore: 88,
    safetyScore: 80,
    accessibilityScore: 74,
    aiSummary:
      'Spokojna lokalizacja w pobliżu terenów zielonych. Dobre miejsce dla osób wrażliwych na hałas i z wygodnym dostępem do komunikacji miejskiej.',
  },
  {
    id: 'building-2',
    name: 'Budynek Wrzeszcz 1',
    district: 'Wrzeszcz',
    address: 'ul. Grunwaldzka 44, Gdańsk',
    lat: 54.3806,
    lng: 18.6057,
    overallScore: 68,
    priceScore: 61,
    noiseScore: 52,
    safetyScore: 76,
    accessibilityScore: 71,
    aiSummary:
      'Bardzo dobra infrastruktura i dostęp do usług, ale lokalizacja przy bardziej ruchliwej ulicy może oznaczać wyższy poziom hałasu.',
  },
  {
    id: 'building-3',
    name: 'Budynek Zaspa 1',
    district: 'Zaspa',
    address: 'ul. Pilotów 3, Gdańsk',
    lat: 54.3904,
    lng: 18.6201,
    overallScore: 75,
    priceScore: 66,
    noiseScore: 73,
    safetyScore: 79,
    accessibilityScore: 83,
    aiSummary:
      'Dobrze skomunikowana okolica z sensownym balansem między ceną, spokojem i dostępnością usług codziennych.',
  },
];

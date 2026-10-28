// Filtry parametrów mieszkania (cena, pokoje, metraż...).
// Filtrowane w backendzie - patrz ApartmentFilter w backend/api/filters.py.

export type Range = [number, number];

export type ApartmentFilters = {
  price: Range;
  rooms: string[];
  area: Range;
  floors: string[];
  yearBuilt: string[];
  elevatorOnly: boolean;
  pricePerM2: Range;
  districts: string[];
};

export type RangeLimits = { min: number; max: number; step: number };

export const FILTER_LIMITS = {
  price: { min: 0, max: 10000, step: 100 },
  area: { min: 10, max: 200, step: 5 },
  pricePerM2: { min: 20, max: 200, step: 5 },
} satisfies Record<string, RangeLimits>;

export type ChipOption = { value: string; label: string };

export const ROOM_OPTIONS: ChipOption[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4+', label: '4+' },
];

export const FLOOR_OPTIONS: ChipOption[] = [
  { value: 'ground', label: 'Parter' },
  { value: '1-3', label: '1–3' },
  { value: '4+', label: '4+' },
];

export const YEAR_BUILT_OPTIONS: ChipOption[] = [
  { value: 'pre1945', label: 'Przed 1945' },
  { value: '1945-2000', label: '1945–2000' },
  { value: '2000-2015', label: '2000–2015' },
  { value: 'post2015', label: 'Po 2015' },
];

export const DEFAULT_APARTMENT_FILTERS: ApartmentFilters = {
  price: [FILTER_LIMITS.price.min, FILTER_LIMITS.price.max],
  rooms: [],
  area: [FILTER_LIMITS.area.min, FILTER_LIMITS.area.max],
  floors: [],
  yearBuilt: [],
  elevatorOnly: false,
  pricePerM2: [FILTER_LIMITS.pricePerM2.min, FILTER_LIMITS.pricePerM2.max],
  districts: [],
};

export function isRangeActive(range: Range, limits: RangeLimits) {
  return range[0] > limits.min || range[1] < limits.max;
}

// Liczba aktywnych filtrów w sekcji "Mieszkanie"
export function countApartmentFilters(f: ApartmentFilters) {
  return [
    isRangeActive(f.price, FILTER_LIMITS.price),
    f.rooms.length > 0,
    isRangeActive(f.area, FILTER_LIMITS.area),
    f.floors.length > 0,
    f.yearBuilt.length > 0,
    f.elevatorOnly,
    isRangeActive(f.pricePerM2, FILTER_LIMITS.pricePerM2),
  ].filter(Boolean).length;
}

// Filtry -> parametry zapytania /api/apartments/ (wysyłane tylko aktywne)
export function apartmentFiltersToParams(
  f: ApartmentFilters,
  params: URLSearchParams
) {
  const setRange = (
    range: Range,
    limits: RangeLimits,
    minKey: string,
    maxKey: string
  ) => {
    if (range[0] > limits.min) params.set(minKey, String(range[0]));
    if (range[1] < limits.max) params.set(maxKey, String(range[1]));
  };
  const setList = (key: string, values: string[]) => {
    if (values.length > 0) params.set(key, values.join(','));
  };

  setRange(f.price, FILTER_LIMITS.price, 'price_min', 'price_max');
  setRange(f.area, FILTER_LIMITS.area, 'area_min', 'area_max');
  setRange(
    f.pricePerM2,
    FILTER_LIMITS.pricePerM2,
    'price_per_m2_min',
    'price_per_m2_max'
  );
  setList('rooms', f.rooms);
  setList('floors', f.floors);
  setList('year_built', f.yearBuilt);
  setList('districts', f.districts);
  if (f.elevatorOnly) params.set('has_elevator', 'true');
}

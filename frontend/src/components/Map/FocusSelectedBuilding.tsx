import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Przy tym przybliżeniu znaczniki nie są już grupowane w klastry (disableClusteringAtZoom)
const SELECTED_ZOOM = 17;

// Panel boczny zakrywający większość mapy (np. na telefonie) nie przesuwa widoku
const MAX_PANEL_SHARE = 0.6;

// Przybliża mapę do wybranego mieszkania tak, żeby znacznik nie wylądował pod panelem
export default function FocusSelectedBuilding({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (lat === null || lng === null) return;

    const mapWidth = map.getSize().x;
    const panel = document.querySelector('aside[aria-expanded="true"]');
    const panelWidth = panel?.getBoundingClientRect().width ?? 0;
    const rightPadding =
      panelWidth < mapWidth * MAX_PANEL_SHARE ? panelWidth : 0;

    const point = L.latLng(lat, lng);
    map.flyToBounds(L.latLngBounds(point, point), {
      maxZoom: Math.max(map.getZoom(), SELECTED_ZOOM),
      paddingBottomRight: [rightPadding, 0],
      duration: 0.8,
    });
  }, [lat, lng, map]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';

import { buildingMarkerIcon, getBuildingMarkerIconHovered } from './mapStyles';
import styles from './Map.module.css';

export type BuildingMarker = {
  id: number | string;
  name?: string;
  district?: string | null;
  price?: number | string;
  lat: number;
  lng: number;
};

interface Props {
  buildings: BuildingMarker[];
  hoveredBuildingId: number | string | null;
  setHoveredBuildingId: (id: number | string | null) => void;
  isDarkTheme: boolean;
}

function rozmiarKlastra(liczba: number) {
  if (liczba < 10) return { klasa: styles.clusterSmall, px: 36 };
  if (liczba < 100) return { klasa: styles.clusterMedium, px: 44 };
  return { klasa: styles.clusterLarge, px: 52 };
}

function ikonaKlastra(cluster: L.MarkerCluster) {
  const liczba = cluster.getChildCount();
  const { klasa, px } = rozmiarKlastra(liczba);

  return L.divIcon({
    html: `<div class="${styles.cluster} ${klasa}"><span>${liczba}</span></div>`,
    className: '',
    iconSize: L.point(px, px),
  });
}

function trescPopupu(building: BuildingMarker) {
  return `
    <div>
      <strong>${building.name ?? 'Oferta'}</strong><br />
      ${building.district ?? 'brak dzielnicy'}<br />
      Cena: ${building.price ?? '-'} zł
    </div>
  `;
}

export default function ClusteredBuildings({
  buildings,
  hoveredBuildingId,
  setHoveredBuildingId,
  isDarkTheme,
}: Props) {
  const map = useMap();
  const grupaRef = useRef<L.MarkerClusterGroup | null>(null);
  const markeryRef = useRef<Map<number | string, L.Marker>>(new Map());

  useEffect(() => {
    const grupa = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      chunkedLoading: true,
      iconCreateFunction: ikonaKlastra,
    });

    const markery = markeryRef.current;
    grupaRef.current = grupa;
    map.addLayer(grupa);

    return () => {
      map.removeLayer(grupa);
      grupaRef.current = null;
      markery.clear();
    };
  }, [map]);

  useEffect(() => {
    const grupa = grupaRef.current;
    if (!grupa) return;

    grupa.clearLayers();
    markeryRef.current.clear();

    const markery = buildings
      .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
      .map((building) => {
        const marker = L.marker([building.lat, building.lng], {
          icon: buildingMarkerIcon,
        });

        marker.bindPopup(trescPopupu(building));
        marker.on('mouseover', () => setHoveredBuildingId(building.id));
        marker.on('mouseout', () => setHoveredBuildingId(null));

        markeryRef.current.set(building.id, marker);
        return marker;
      });

    grupa.addLayers(markery);
  }, [buildings, setHoveredBuildingId]);

  useEffect(() => {
    markeryRef.current.forEach((marker, id) => {
      const aktywny = id === hoveredBuildingId;
      marker.setIcon(
        aktywny ? getBuildingMarkerIconHovered(isDarkTheme) : buildingMarkerIcon
      );
      marker.setZIndexOffset(aktywny ? 2500 : 500);
    });
  }, [hoveredBuildingId, isDarkTheme]);

  return null;
}

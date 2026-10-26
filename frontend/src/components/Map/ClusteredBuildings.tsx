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

type BuildingId = number | string;

interface Props {
  buildings: BuildingMarker[];
  hoveredBuildingId: BuildingId | null;
  setHoveredBuildingId: (id: BuildingId | null) => void;
  selectedBuildingId: BuildingId | null;
  // kliknięcie znacznika wybiera mieszkanie (panel pokazuje jego szczegóły)
  onSelectBuilding: (id: BuildingId) => void;
  isDarkTheme: boolean;
}

function clusterSize(count: number) {
  if (count < 10) return { className: styles.clusterSmall, px: 36 };
  if (count < 100) return { className: styles.clusterMedium, px: 44 };
  return { className: styles.clusterLarge, px: 52 };
}

function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const { className, px } = clusterSize(count);

  return L.divIcon({
    html: `<div class="${styles.cluster} ${className}"><span>${count}</span></div>`,
    className: '',
    iconSize: L.point(px, px),
  });
}

export default function ClusteredBuildings({
  buildings,
  hoveredBuildingId,
  setHoveredBuildingId,
  selectedBuildingId,
  onSelectBuilding,
  isDarkTheme,
}: Props) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<BuildingId, L.Marker>>(new Map());

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      chunkedLoading: true,
      iconCreateFunction: clusterIcon,
    });

    const markers = markersRef.current;
    groupRef.current = group;
    map.addLayer(group);

    return () => {
      map.removeLayer(group);
      groupRef.current = null;
      markers.clear();
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.clearLayers();
    markersRef.current.clear();

    const markers = buildings
      .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
      .map((building) => {
        const marker = L.marker([building.lat, building.lng], {
          icon: buildingMarkerIcon,
          title: building.name,
        });

        marker.on('click', () => onSelectBuilding(building.id));
        marker.on('mouseover', () => setHoveredBuildingId(building.id));
        marker.on('mouseout', () => setHoveredBuildingId(null));

        markersRef.current.set(building.id, marker);
        return marker;
      });

    group.addLayers(markers);
  }, [buildings, setHoveredBuildingId, onSelectBuilding]);

  // wyróżnienie znacznika najechanego albo wybranego mieszkania
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const active = id === hoveredBuildingId || id === selectedBuildingId;
      marker.setIcon(
        active ? getBuildingMarkerIconHovered(isDarkTheme) : buildingMarkerIcon
      );
      marker.setZIndexOffset(active ? 2500 : 500);
    });
  }, [hoveredBuildingId, selectedBuildingId, isDarkTheme, buildings]);

  return null;
}

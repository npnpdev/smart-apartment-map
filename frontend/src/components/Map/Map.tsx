import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { useEffect, useState } from 'react';
import MapController from '../MapController.tsx';
import RightSidePanel from '../RightSidePanel/RightSidePanel.tsx';

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [map]);

  return null;
}

const cities: { name: string; center: LatLngExpression }[] = [
  { name: 'Gdańsk', center: [54.352, 18.6466] },
  { name: 'Gdynia', center: [54.5189, 18.5305] },
  { name: 'Sopot', center: [54.4418, 18.5601] },
  { name: 'OlsztynKOCHAM', center: [53.7784, 20.4801] },
];

export default function Map() {
  const [selectedCityIdx, setSelectedCityIdx] = useState(0);

  function onChangeCity(): void {
    setSelectedCityIdx((prev) => (prev < cities.length - 1 ? prev + 1 : 0));
  }

  return (
    // WAŻNE: relative, żeby SidePanel absolute działał "nad mapą"
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <MapContainer
        center={cities[0].center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <FixMapSize />
        <MapController center={cities[selectedCityIdx].center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
      </MapContainer>
      <RightSidePanel
        cityName={cities[selectedCityIdx].name}
        onChangeCity={onChangeCity}
      />
    </div>
  );
}

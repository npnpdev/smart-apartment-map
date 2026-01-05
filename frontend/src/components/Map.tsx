import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [map]);

  return null;
}

export default function GdanskMap() {
  const gdansk: [number, number] = [54.3520, 18.6466];

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={gdansk} zoom={12} style={{ height: "100%", width: "100%" }}>
        <FixMapSize />
        <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
        />
      </MapContainer>
    </div>
  );
}

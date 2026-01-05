import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import SidePanel from "./SidePanel/SidePanel";

function FixMapSize() {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }, [map]);

  return null;
}

export default function Map() {
  const gdansk: [number, number] = [54.352, 18.6466];

  return (
    // WAŻNE: relative, żeby SidePanel absolute działał "nad mapą"
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer
        center={gdansk}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <FixMapSize />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
      </MapContainer>

      <SidePanel side="right" title="Legenda / Filtry">
        <label>
          <input type="checkbox" /> Warstwa A
        </label>
        <br />
        <label>
          <input type="checkbox" /> Warstwa B
        </label>
      </SidePanel>
    </div>
  );
}

import { MapContainer, TileLayer, useMap  } from "react-leaflet";
import type {LatLngExpression} from 'leaflet';

import { useEffect } from "react";

import SidePanel from "./SidePanel/SidePanel";
import styles from "./SidePanel/SidePanel.module.css";

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
  const gdansk: LatLngExpression = [54.372158, 18.638306];

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

     <SidePanel
  side="right"
  title="Gdańsk Housing"
  subtitle="PLATFORMA ANALITYCZNA"
  width={560}
>
  <div className={styles.chips}>
    <button className={styles.chip}>Wszystkie</button>
    <button className={styles.chip}>Ciche Strefy</button>
    <button className={`${styles.chip} ${styles.chipActive}`}>Budżet &lt; 3500</button>
  </div>

  <div className={styles.empty}>
    <div>
      <div className={styles.emptyIcon}>🏢</div>
      <div className={styles.emptyText}>
        Wybierz budynek na mapie,<br />aby pobrać dane.
      </div>
    </div>
  </div>
</SidePanel>

    </div>
  );
}

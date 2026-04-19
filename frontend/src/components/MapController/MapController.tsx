import type {LatLngExpression} from "leaflet";
import {useMap} from "react-leaflet";
import {useEffect} from "react";

export default function MapController({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, 12);
  }, [center, map]);

  return null;
}
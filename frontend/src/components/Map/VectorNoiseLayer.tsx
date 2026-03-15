import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

export default function VectorNoiseLayer({ showLayer }: { showLayer: boolean }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  const getNoiseColor = (minval: number) => {
    if (minval >= 75) return '#000080';
    if (minval >= 70) return '#0000FF';
    if (minval >= 65) return '#800080';
    if (minval >= 60) return '#FF0000';
    return '#FF8000';
  };

  useEffect(() => {
    if (!showLayer) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    if (showLayer && !layerRef.current) {
      fetch('/data/gdansk_noise.geojson')
        .then((res) => res.json())
        .then((data) => {
          // @ts-ignore
          layerRef.current = L.vectorGrid.slicer(data, {
            rendererFactory: L.canvas.tile,
            vectorTileLayerStyles: {
              sliced: function (properties: any) {
                return {
                  fillColor: getNoiseColor(properties.MINVAL ?? 55),
                  fillOpacity: 0.55,
                  stroke: false,
                  fill: true
                };
              }
            },
            interactive: false,
            maxZoom: 22,
            zIndex: 200
          }).addTo(map);
        })
        .catch(err => console.error("Błąd lokalnego pliku hałasu:", err));
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [showLayer, map]);

  return null;
}

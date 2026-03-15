import { divIcon } from 'leaflet';
import styles from './Map.module.css';

// --- FUNKCJE POMOCNICZE DO KOLORÓW I ETYKIET ---
export const getSafetyLabel = (val: number) => {
  if (val < 15) return 'Bardzo Wysokie';
  if (val < 30) return 'Wysokie';
  if (val < 50) return 'Średnie';
  return 'Niskie';
};

export const getColor = (wskaznik?: number) => {
  if (wskaznik === undefined || wskaznik === null) return '#ffffff';
  if (wskaznik >= 60) return '#d73027';
  if (wskaznik >= 45) return '#fc8d59';
  if (wskaznik >= 30) return '#fee08b';
  if (wskaznik >= 20) return '#ffffbf';
  if (wskaznik >= 15) return '#d9ef8b';
  if (wskaznik >= 10) return '#91cf60';
  return '#1a9850';
};

export const getTextColor = (wskaznik?: number) => {
  if (wskaznik === undefined || wskaznik === null) return '#333333';
  if (wskaznik >= 60) return '#b2182b';
  if (wskaznik >= 45) return '#d6604d';
  if (wskaznik >= 30) return '#b8860b';
  if (wskaznik >= 20) return '#8c7d00';
  if (wskaznik >= 15) return '#4d9221';
  if (wskaznik >= 10) return '#276419';
  return '#00441b';
};

// --- MARKERY (IKONY) ---
export const buildingMarkerIcon = divIcon({
  className: '',
  html: `
    <div class="${styles.markerWrap}">
      <div class="${styles.marker}">
        <svg class="${styles.markerHouse}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.5 9.5V19H17.5V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 19V14H14V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="${styles.markerDot}"></div>
    </div>
  `,
  iconSize: [42, 48],
  iconAnchor: [21, 48],
  popupAnchor: [0, -44],
});

export const getBuildingMarkerIconHovered = (isDarkTheme: boolean) => {
  const fgColor = isDarkTheme ? '#111111' : '#f3f3f1'; 
  const bgColor = isDarkTheme ? '#f3f3f1' : '#181716'; 
  
  return divIcon({
    className: '',
    html: `
      <div style="width: 42px; height: 42px; position: relative; transform: scale(1.15); transition: transform 0.2s; z-index: 2000;">
        <div style="width: 42px; height: 42px; border-radius: 16px; background-color: ${bgColor} !important; border: 1px solid ${bgColor} !important; box-shadow: 0 14px 30px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: ${fgColor} !important;">
            <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6.5 9.5V19H17.5V9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 19V14H14V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div style="position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); width: 10px; height: 10px; border-radius: 999px; background-color: ${fgColor} !important; border: 2px solid ${bgColor} !important; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [42, 48],
    iconAnchor: [21, 48],
    popupAnchor: [0, -44],
  });
};

export const educationMarkerIcon = divIcon({
  className: '',
  html: `
    <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #3b82f6; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

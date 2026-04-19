import pandas as pd
import requests
import time
import os

# Ścieżka do Twojego pliku z mieszkaniami
CSV_FILE = 'data/mieszkania.csv'
API_URL = "https://geogdansk.pl/server/rest/services/WSrod/Halas_Drogi_LDWN/MapServer/0/query"

def sprawdz_halas(lat, lng):
    """Pyta serwer GeoGdańsk o konkretny punkt."""
    params = {
        "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "MAXVAL", 
        "returnGeometry": "false",
        "f": "json"
    }
    
    try:
        response = requests.get(API_URL, params=params, timeout=10)
        if response.status_code == 200:
            dane = response.json()
            if 'features' in dane and len(dane['features']) > 0:
                # Szukamy największej wartości, jeśli punkt leży na złączeniu poligonów
                max_halas = 0
                for feature in dane['features']:
                    wartosc = feature.get('attributes', {}).get('MAXVAL', 0)
                    if wartosc > max_halas:
                        max_halas = wartosc
                return max_halas
        # Jeśli API zwróci pustą listę 'features', oznacza to strefę ciszy (<50 dB)
        return 45 
    except Exception as e:
        print(f"Błąd sieci dla {lat}, {lng}: {e}")
        return None

def aktualizuj_mieszkania():
    if not os.path.exists(CSV_FILE):
        print(f"Błąd: Nie znaleziono pliku {CSV_FILE}")
        return

    print("Rozpoczynam pobieranie danych o hałasie z GeoGdańsk...")
    df = pd.read_csv(CSV_FILE)
    
    # Tworzymy kolumnę, jeśli nie istnieje
    if 'noise_db' not in df.columns:
        df['noise_db'] = None
        
    zaaktualizowano = 0
    for index, row in df.iterrows():
        # Pobiera hałas tylko dla tych, które go nie mają (idealne do CRONa w przyszłości)
        if pd.isna(row.get('noise_db')):
            nazwa = row['name']
            lat, lng = row['lat'], row['lng']
            
            print(f"Sprawdzam: {nazwa} ({lat}, {lng})... ", end="")
            halas = sprawdz_halas(lat, lng)
            
            if halas is not None:
                df.at[index, 'noise_db'] = int(halas)
                print(f"Wynik: {halas} dB")
                zaaktualizowano += 1
            else:
                print("BŁĄD")
            
            # Bezpieczny timeout, żeby serwer Gdańska nas nie zablokował
            time.sleep(0.3)
            
    df.to_csv(CSV_FILE, index=False)
    print(f"\nZakończono! Zaktualizowano {zaaktualizowano} mieszkań. Plik zapisany.")

if __name__ == "__main__":
    aktualizuj_mieszkania()

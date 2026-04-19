import urllib.request
import urllib.parse
import json
import time

OUTPUT_FILENAME = "/app/data/gdansk_halas.geojson"
BASE_URL = "https://geogdansk.pl/server/rest/services/WSrod/Halas_Drogi_LDWN/MapServer/0/query"

def download_noise():
    print("Rozpoczynam pobieranie mapy halasu z GeoGdansk...")
    
    params_ids = urllib.parse.urlencode({'where': '1=1', 'returnIdsOnly': 'true', 'f': 'json'})
    
    try:
        req_ids = urllib.request.Request(BASE_URL + "?" + params_ids)
        with urllib.request.urlopen(req_ids) as response:
            ids_data = json.loads(response.read().decode('utf-8'))
            
        object_ids = ids_data.get("objectIds")
        if not object_ids:
            print("Blad: Serwer nie zwrocil zadnych ID.")
            return

        total = len(object_ids)
        print(f"Znaleziono {total} fragmentow mapy. Pobieram paczkami...")
        
        all_features =[]
        chunk_size = 200
        
        for i in range(0, total, chunk_size):
            chunk = object_ids[i : i+chunk_size]
            ids_str = ",".join([str(x) for x in chunk])
            print(f"Pobieranie paczki od {i} do {i+len(chunk)} z {total}...")
            
            params_data = urllib.parse.urlencode({
                'objectIds': ids_str,
                'outFields': '*',
                'outSR': '4326',
                'f': 'geojson'
            })
            
            req_data = urllib.request.Request(BASE_URL + "?" + params_data)
            with urllib.request.urlopen(req_data) as res:
                data_json = json.loads(res.read().decode('utf-8'))
                
                # Zmieniony zapis, zeby nie ucialo bota
                if "features" in data_json:
                    all_features.extend(data_json["features"])
            
            time.sleep(0.5)

        print(f"Pobrano wszystkie {len(all_features)} obiekty. Zapisuje plik...")
        
        final_geojson = {
            "type": "FeatureCollection",
            "features": all_features
        }
        
        with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as f:
            json.dump(final_geojson, f, ensure_ascii=False)
            
        print(f"Gotowe! Plik zapisany jako {OUTPUT_FILENAME}")
        print("PRZENIES TEN PLIK RECZNIE Z FOLDERU 'data' DO 'frontend/public/data/'")
        
    except Exception as e:
        print(f"Krytyczny Blad: {e}")

if __name__ == "__main__":
    download_noise()
import os
import csv
import time
import requests
import json
from bs4 import BeautifulSoup

def fetch_detail_json(url):
    # Nagłówki udające prawdziwą przeglądarkę
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"\n[ERROR] Błąd pobierania: {url}. Kod statusu: {response.status_code}")
        return None
        
    soup = BeautifulSoup(response.text, 'html.parser')
    script_tag = soup.find('script', id='__NEXT_DATA__')
    
    if script_tag:
        return json.loads(script_tag.string)
    return None

def parse_floor(floor_value_list):
    # Zamiana np. ["floor_1"] na liczbę 1 (lub parteru na 0)
    if not floor_value_list:
        return None
    floor_str = floor_value_list[0]
    if "ground" in floor_str or "parter" in floor_str:
        return 0
    digits = "".join([char for char in floor_str if char.isdigit()])
    return int(digits) if digits else None

def map_to_complete_apartment(detail_json):
    # Wyciąganie głównego słownika ogłoszenia
    ad_data = detail_json.get('props', {}).get('pageProps', {}).get('ad') or {}
    target_data = ad_data.get('target') or {}
    
    # Całkowicie uodpornione na 'null' pobieranie zagnieżdżonej lokalizacji
    location = ad_data.get('location') or {}
    coordinates = location.get('coordinates') or {}
    lat = coordinates.get('latitude')
    lon = coordinates.get('longitude')
    
    # Bezpieczne rozbicie adresu
    address_dict = location.get('address') or {}
    district_dict = address_dict.get('district') or {}
    address = district_dict.get('name')
    
    # Bezpieczne wyciąganie liczby pokoi (odporne na puste listy)
    rooms_list = target_data.get('Rooms_num') or []
    rooms = rooms_list[0] if rooms_list else None
    
    # Wyciąganie roku budowy
    build_year_str = target_data.get('Build_year')
    year_built = int(build_year_str) if build_year_str and build_year_str.isdigit() else None
    
    # Wyciąganie piętra
    floor = parse_floor(target_data.get('Floor_no'))
    
    # Wyciąganie informacji o windzie
    has_elevator = None
    for info in ad_data.get('additionalInformation', []):
        if info.get('label') == 'lift':
            values = info.get('values') or []
            if values and '::y' in values[0]:
                has_elevator = True
            elif values and '::n' in values[0]:
                has_elevator = False

    apartment = {
        "external_id": str(ad_data.get('id')),
        "source_portal": "otodom",
        "source_url": ad_data.get('url'),
        "title": ad_data.get('title'),
        "description": ad_data.get('description'), 
        "offer_type": "rent", 
        "price": target_data.get('Price'),
        "area": target_data.get('Area'),
        "rooms": rooms,
        "floor": floor,
        "year_built": year_built,
        "has_elevator": has_elevator,
        "is_accessible": None,
        "location": f"POINT({lon} {lat})" if lon and lat else None,
        "address": address,
        "district_id": None, 
        "noise_db_min": None,
        "noise_db_max": None
    }
    
    return apartment

def get_scraped_ids(file_path):
    # Funkcja sprawdzająca, które ID już pobraliśmy (do systemu wznawiania)
    if not os.path.exists(file_path):
        return set()
    
    scraped_ids = set()
    with open(file_path, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row.get("external_id"):
                scraped_ids.add(row["external_id"])
    return scraped_ids

if __name__ == "__main__":
    queue_csv = os.path.join("data", "listings.csv")
    output_csv = os.path.join("data", "complete_listings.csv")
    
    if not os.path.exists(queue_csv):
        print(f"[ERROR] Brak pliku {queue_csv}. Uruchom najpierw collector.py!")
        exit(1)
        
    # 1. Sprawdzamy co już pobraliśmy wcześniej
    already_scraped = get_scraped_ids(output_csv)
    if already_scraped:
        print(f"[INFO] Znaleziono {len(already_scraped)} już pobranych ogłoszeń. Pomijam je.")

    # Zdefiniowanie nagłówków dla pliku wyjściowego
    headers = [
        "external_id", "source_portal", "source_url", "title", "description", 
        "offer_type", "price", "area", "rooms", "floor", "year_built", 
        "has_elevator", "is_accessible", "location", "address", 
        "district_id", "noise_db_min", "noise_db_max"
    ]
    
    # Tworzymy plik wyjściowy z nagłówkami (tylko jeśli nie istnieje)
    if not os.path.exists(output_csv):
        with open(output_csv, mode="w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            writer.writeheader()

    # 2. Wczytujemy naszą kolejkę linków do pobrania
    queue_listings = []
    with open(queue_csv, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            queue_listings.append(row)

    print(f"[INFO] Rozpoczynam pobieranie szczegółów dla {len(queue_listings)} ogłoszeń...")
    
    # 3. Pętla pobierająca szczegóły
    success_count = 0
    for index, listing in enumerate(queue_listings, start=1):
        external_id = listing["external_id"]
        url = listing["source_url"]
        
        # System wznawiania: pomijamy jeśli ID już istnieje w complete_listings.csv
        if external_id in already_scraped:
            continue
            
        print(f"[{index}/{len(queue_listings)}] Przetwarzam ID: {external_id}...", end="", flush=True)
        
        # Pobieramy JSON szczegółów
        raw_detail_json = fetch_detail_json(url)
        
        if raw_detail_json:
            complete_apartment = map_to_complete_apartment(raw_detail_json)
            
            # Zapisujemy na bieżąco (append mode 'a') do pliku CSV
            with open(output_csv, mode="a", encoding="utf-8", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=headers)
                writer.writerow(complete_apartment)
                
            print(" ZAPISANO.")
            success_count += 1
            
            # Pauza 2 sekundy (bardzo ważne, żeby Otodom nas nie zablokował przy pętli)
            time.sleep(2.0)
        else:
            print(" BŁĄD POBIERANIA (pomijam).")
            # Dodatkowa pauza po błędzie
            time.sleep(3.0)

    print(f"\n[SUKCES] Koniec pracy! Dodano {success_count} nowych ogłoszeń do {output_csv}")
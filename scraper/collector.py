import os
import csv
import time
import requests
import json
from bs4 import BeautifulSoup

def fetch_raw_json(page=1):
    """
    Pobiera surowy JSON Next.js dla konkretnej strony wyników wyszukiwania.
    """
    url = f"https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/pomorskie/gdansk/gdansk/gdansk?page={page}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    script_tag = soup.find('script', id='__NEXT_DATA__')
    
    if script_tag:
        return json.loads(script_tag.string)
    return None

def map_to_apartment(raw_data):
    """
    Pobiera surowy słownik z JSON-a i mapuje go do struktury odpowiadającej tabeli Apartment.
    """
    if not raw_data.get('id'):
        return None

    # Safe extraction of nested dictionaries
    location = raw_data.get('location') or {}
    coordinates = location.get('coordinates') or {}
    lat = coordinates.get('latitude')
    lon = coordinates.get('longitude')
    
    reverse_geo = location.get('reverseGeocoding') or {}
    locations_list = reverse_geo.get('locations') or [{}]
    address = locations_list[0].get('fullName') if locations_list else None
    
    total_price = raw_data.get('totalPrice') or {}
    price = total_price.get('value')

    apartment = {
        "external_id": str(raw_data.get('id')),
        "source_portal": "otodom",
        "source_url": f"https://www.otodom.pl/pl/oferta/{raw_data.get('slug')}" if raw_data.get('slug') else None,
        "title": raw_data.get('title'),
        "description": None, 
        "offer_type": "rent", 
        "price": price,
        "area": raw_data.get('areaInSquareMeters'),
        "rooms": raw_data.get('roomsNumber'),
        "floor": None, 
        "year_built": None, 
        "has_elevator": None, 
        "is_accessible": None,
        "location": f"POINT({lon} {lat})" if lon and lat else None,
        "address": address,
        "district_id": None, 
        "noise_db_min": None,
        "noise_db_max": None
    }
    
    return apartment

def save_to_csv(apartments, folder_name="data", file_name="listings.csv"):
    """
    Zapisuje listę zmapowanych słowników do pliku CSV w określonym folderze.
    """
    # Create folder if it does not exist yet
    os.makedirs(folder_name, exist_ok=True)
    file_path = os.path.join(folder_name, file_name)
    
    if not apartments:
        print("No data to save.")
        return
        
    # Headers are derived directly from our dictionary keys
    headers = list(apartments[0].keys())
    
    with open(file_path, mode="w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(apartments)
        
    print(f"\n[INFO] Successfully saved {len(apartments)} records to: {file_path}")

if __name__ == "__main__":
    print("[INFO] Starting discovery phase...")
    
    # 1. Fetch page 1 to analyze total page count dynamically
    first_page_data = fetch_raw_json(page=1)
    
    if not first_page_data:
        print("[ERROR] Failed to fetch first page. Aborting.")
        exit(1)
        
    try:
        total_pages = first_page_data['props']['pageProps']['tracking']['listing']['page_count']
        print(f"[INFO] Auto-detected total pages to scrape: {total_pages}")
    except KeyError:
        # Fallback value in case JSON structure path changes
        total_pages = 5
        print(f"[WARNING] Could not detect page count. Falling back to default: {total_pages} pages.")
    
    all_mapped_apartments = []
    
    # 2. Iterate through all detected pages
    for page in range(1, total_pages + 1):
        print(f"Scraping page {page}/{total_pages}...")
        
        # We already have first page loaded, no need to make second network request for page 1
        if page == 1:
            page_data = first_page_data
        else:
            page_data = fetch_raw_json(page=page)
            # Be polite to servers to avoid bans
            time.sleep(1.5)
            
        if not page_data:
            print(f"[WARNING] Failed to fetch page {page}. Skipping.")
            continue
            
        try:
            raw_ads = page_data['props']['pageProps']['data']['searchAds']['items']
        except KeyError:
            print(f"[WARNING] Unexpected JSON structure on page {page}. Skipping.")
            continue
            
        page_mapped_count = 0
        for ad in raw_ads:
            mapped_ad = map_to_apartment(ad)
            if mapped_ad:
                all_mapped_apartments.append(mapped_ad)
                page_mapped_count += 1
        
        print(f"-> Page {page} finished. Mapped {page_mapped_count} apartments.")
        
    # 3. Save all results into the CSV file inside 'data' directory
    save_to_csv(all_mapped_apartments, folder_name="data", file_name="listings.csv")
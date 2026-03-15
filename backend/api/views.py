import csv
import os
from django.http import HttpResponse
import requests
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.core.cache import cache

# --- KONFIGURACJA ---
DATA_DIR_NAME = 'data'
SAFETY_FILENAME = 'bezpieczenstwo_gdansk.csv'
APARTMENTS_FILENAME = 'mieszkania.csv' 
EDUCATION_FILENAME = 'edukacja.csv'
GEOGDANSK_NOISE_URL = "https://geogdansk.pl/server/services/Srodowisko/Mapa_halasu/MapServer/WMSServer"

CACHE_TTL = 60 * 60 * 24

UNIVERSITY_KEYWORDS = ("uniwersytet", "akademia", "politechnika", "wyższa szkoła")
PRIMARY_KEYWORDS = ("podstawow", "podstawów")
SECONDARY_KEYWORDS = ("liceum", "technikum", "branżowa", "branzowa", "zawodowa")

def _get_data_file_path(filename):
    """
    Prywatna funkcja pomocnicza budująca absolutną ścieżkę do pliku danych.
    """
    return os.path.join(settings.BASE_DIR, DATA_DIR_NAME, filename)

# --- ENDPOINTY ---

@api_view(["GET"])
@permission_classes([AllowAny])
def health(request): 
    """
    Prosty health-check dla monitoringu statusu usługi.
    """
    return Response({"status": "ok"})

@api_view(["GET"])
@permission_classes([AllowAny])
def get_safety_data(request):
    """
    Endpoint udostępniający dane o bezpieczeństwie w podziale na dzielnice.
    Dane są odczytywane z przygotowanego wcześniej pliku CSV.
    """
    data = cache.get('safety_data')
    
    if not data:
        file_path = _get_data_file_path(SAFETY_FILENAME)
        
        if not os.path.exists(file_path):
            return Response(
                {"error": "Źródło danych (plik CSV - bezpieczeństwo) nie zostało znalezione."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            with open(file_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                data = list(reader)
                
            cache.set('safety_data', data, timeout=CACHE_TTL)
        except Exception as e:
            return Response(
                {"error": "Wystąpił błąd podczas przetwarzania danych.", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    return Response(data, status=status.HTTP_200_OK)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_apartments_data(request):
    """
    Endpoint udostępniający dane o mieszkaniach.
    Zwraca wygenerowaną z pliku CSV listę słowników. Używa cache'owania.
    """
    data = cache.get('apartments_data')
    
    if not data:
        apartments_path = _get_data_file_path(APARTMENTS_FILENAME)
        
        if not os.path.exists(apartments_path):
            return Response({"error": "Brak pliku dla mieszkań."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        try:
            with open(apartments_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                # Zamieniamy na listę i konwertujemy typy, jeśli potrzeba
                data = list(reader)
                
            cache.set('apartments_data', data, timeout=CACHE_TTL)
        except Exception as e:
            return Response({"error": "Błąd", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(data, status=status.HTTP_200_OK)

def classify_education_type(row):
    """
    Klasyfikuje typ placówki edukacyjnej na podstawie tagów z OpenStreetMap.
    """
    amenity = row.get("amenity", "").strip().lower()
    name = row.get("name", "").strip().lower()
    school_type = row.get("school", "").strip().lower()
    isced = row.get("isced:level", "").strip()

    # Przedszkola
    if amenity == "kindergarten":
        return "Przedszkola"

    # Uczelnie
    if amenity in ("university", "college") or any(x in name for x in UNIVERSITY_KEYWORDS):
        return "Uczelnie"

    # Szkoły
    if amenity == "school":
        # Sprawdzamy tag isced (1 i 2 to podstawówka, 3 to szkoła średnia)
        if "1" in isced or "2" in isced:
            return "Podstawowe"
        if "3" in isced:
            return "Średnie"
            
        # Sprawdzamy bezpośredni tag school
        if school_type == "primary":
            return "Podstawowe"
        if school_type in ("secondary", "technical_college"):
            return "Średnie"

        # Jeżeli tagów nie ma, szukamy po nazwie placówki
        if any(x in name for x in PRIMARY_KEYWORDS):
            return "Podstawowe"
            
        if any(x in name for x in SECONDARY_KEYWORDS):
            return "Średnie"

    # Jeśli nic nie pasuje
    return "Inne"

@api_view(["GET"])
@permission_classes([AllowAny])
def get_education_data(request):
    """
    Endpoint udostępniający dane o edukacji.
    Czyta dane z CSV, klasyfikuje typy szkół i używa cache.
    """
    data = cache.get('education_data')
    
    if not data:
        education_path = _get_data_file_path(EDUCATION_FILENAME)
        
        if not os.path.exists(education_path):
            return Response({"error": "Brak pliku edukacji."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        try:
            processed_data = []
            
            with open(education_path, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                
                for row in reader:
                    # 1. Zmieniamy nazwy kolumn z @lat/@lon na lat/lng
                    # Używamy .pop() aby od razu usunąć stare klucze
                    row['lat'] = row.pop('@lat', None)
                    row['lng'] = row.pop('@lon', None)
                    
                    # 2. Tworzymy nową kolumnę z typem
                    row['education_type'] = classify_education_type(row)
                    
                    processed_data.append(row)
            
            data = processed_data
            cache.set('education_data', data, timeout=CACHE_TTL)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(data, status=status.HTTP_200_OK)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_noise_data(request):
    """
    Endpoint proxy dla mapy hałasu.
    Front pyta nasze API, nasze API pobiera lekki obrazek z GeoGdańska (lub cache)
    """
    query_params = request.GET.urlencode()
    
    # Tworzymy unikalny klucz cache na podstawie zapytania
    cache_key = f"noise_tile_{query_params}"
    cached_tile = cache.get(cache_key)
    
    if cached_tile:
        return HttpResponse(
            cached_tile['content'], 
            content_type=cached_tile['content_type']
        )
    
    try:
        # Django pyta GeoGdańsk o kafelki
        resp = requests.get(f"{GEOGDANSK_NOISE_URL}?{query_params}", timeout=10)
        resp.raise_for_status()
        
        content_type = resp.headers.get('content-type', 'image/png')
        
        # Zapisujemy binarną zawartość obrazka i jego typ do cache na 24h
        cache.set(
            cache_key, 
            {'content': resp.content, 'content_type': content_type}, 
            timeout=CACHE_TTL
        )
        
        return HttpResponse(resp.content, content_type=content_type)
        
    except Exception as e:
        return Response(
            {"error": "Błąd pobierania warstwy hałasu", "details": str(e)}, 
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
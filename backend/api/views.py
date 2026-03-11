import os
import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import math

# --- KONFIGURACJA ---
DATA_DIR_NAME = 'data'
SAFETY_FILENAME = 'bezpieczenstwo_gdansk.csv'
APARTMENTS_FILENAME = 'mieszkania.csv' 
EDUCATION_FILENAME = 'edukacja.csv'

"""
Prywatna funkcja pomocnicza budująca absolutną ścieżkę do pliku danych.
"""
def _get_data_file_path(filename):
    return os.path.join(settings.BASE_DIR, DATA_DIR_NAME, filename)

# --- NOWE FUNKCJE POMOCNICZE ---

def get_distance_in_km(lat1, lon1, lat2, lon2):
    """
    Funkcja licząca odległość w km między dwoma punktami GPS (wzór Haversine'a).
    To jest pythonowa wersja tego, co mieliśmy w utils.ts.
    """
    R = 6371  # Promień Ziemi w km
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def count_nearby_locations(apartment_row, education_df, radius_km=1.0):
    """
    Funkcja, która dla danego mieszkania liczy, ile placówek edukacyjnych
    znajduje się w zadanym promieniu.
    """
    nearby_count = 0
    for _, edu_row in education_df.iterrows():
        distance = get_distance_in_km(
            apartment_row['lat'], 
            apartment_row['lng'], 
            edu_row['@lat'], 
            edu_row['@lon']
        )
        if distance <= radius_km:
            nearby_count += 1
    return nearby_count

# --- ENDPOINTY ---
"""
Prosty health-check dla monitoringu statusu usługi.
"""
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):    
    return Response({"status": "ok"})

"""
Endpoint udostępniający dane o bezpieczeństwie w podziale na dzielnice.
Dane są odczytywane z przygotowanego wcześniej pliku CSV.
"""
@api_view(["GET"])
@permission_classes([AllowAny])
def get_safety_data(request):
    file_path = _get_data_file_path(SAFETY_FILENAME)
    
    if not os.path.exists(file_path):
        return Response(
            {"error": "Źródło danych (plik CSV) nie zostało znalezione."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        df = pd.read_csv(file_path)
        data = df.to_dict(orient='records')
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {"error": "Wystąpił błąd podczas przetwarzania danych.", "details": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

"""
Endpoint udostępniający dane o mieszkaniach.
Odczytuje mockowe dane z pliku CSV za pomocą pandas.
"""
@api_view(["GET"])
@permission_classes([AllowAny])
def get_apartments_data(request):
    apartments_path = _get_data_file_path(APARTMENTS_FILENAME)
    education_path = _get_data_file_path(EDUCATION_FILENAME)
    
    if not os.path.exists(apartments_path) or not os.path.exists(education_path):
        return Response(
            {"error": "Brak jednego ze źródeł danych (mieszkania lub edukacja)."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Wczytujemy oba pliki CSV
        apartments_df = pd.read_csv(apartments_path)
        education_df = pd.read_csv(education_path)
        
        # Tworzymy nową kolumnę z liczbą placówek w okolicy
        apartments_df['education_nearby_count'] = apartments_df.apply(
            lambda row: count_nearby_locations(row, education_df, radius_km=1.0),
            axis=1
        )
        
        # Konwersja DataFrame na format JSON (lista słowników)
        data = apartments_df.to_dict(orient='records')
        
        return Response(data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {"error": "Wystąpił błąd podczas przetwarzania danych mieszkań.", "details": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
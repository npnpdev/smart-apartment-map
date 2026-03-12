import os
import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import math
import numpy as np

# --- KONFIGURACJA ---
DATA_DIR_NAME = 'data'
SAFETY_FILENAME = 'bezpieczenstwo_gdansk.csv'
APARTMENTS_FILENAME = 'mieszkania.csv' 
EDUCATION_FILENAME = 'edukacja.csv'


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


@api_view(["GET"])
@permission_classes([AllowAny])
def get_apartments_data(request):
    """
    Endpoint udostępniający czyste dane o mieszkaniach.
    """
    apartments_path = _get_data_file_path(APARTMENTS_FILENAME)
    
    if not os.path.exists(apartments_path):
        return Response({"error": "Brak pliku mieszkania.csv."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    try:
        df = pd.read_csv(apartments_path)
        data = df.to_dict(orient='records')
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": "Wystąpił błąd", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
def classify_education_type(row):
    amenity = str(row.get("amenity") or "").strip().lower()
    name = str(row.get("name") or "").strip().lower()
    school_type = str(row.get("school") or "").strip().lower()
    isced = str(row.get("isced:level") or "").strip()

    # Przedszkola
    if amenity == "kindergarten":
        return "Przedszkola"

    # Uczelnie
    if amenity in ["university", "college"] or any(x in name for x in ["uniwersytet", "akademia", "politechnika", "wyższa szkoła"]):
        return "Uczelnie"

    # Szkoły
    if amenity == "school":
        # Sprawdzamy tag isced (1 i 2 to podstawówka, 3 to szkoła średnia)
        if "1" in isced or "2" in isced:
            return "Podstawowe"
        if "3" in isced:
            return "Średnie"
            
        # Sprawdzamy bezpośredni tag school
        if school_type in ["primary"]:
            return "Podstawowe"
        if school_type in ["secondary", "technical_college"]:
            return "Średnie"

        # Jeżeli tagów nie ma, szukamy po nazwie placówki
        if any(x in name for x in ["podstawow", "podstawów"]):
            return "Podstawowe"
            
        if any(x in name for x in ["liceum", "technikum", "branżowa", "branzowa", "zawodowa"]):
            return "Średnie"

    # Jeśli nic nie pasuje (np. szkoły muzyczne bez innych tagów), zwracamy "Inne" (frontend prawdopodobnie to zignoruje)
    return "Inne"


@api_view(["GET"])
@permission_classes([AllowAny])
def get_education_data(request):
    education_path = _get_data_file_path(EDUCATION_FILENAME)
    
    if not os.path.exists(education_path):
        return Response({"error": "Brak pliku."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    try:
        df = pd.read_csv(education_path)
        
        # 1. Zmieniamy nazwy
        df.rename(columns={'@lat': 'lat', '@lon': 'lng'}, inplace=True)
        
        # 2. DODANO: Tworzymy nową kolumnę z typem pod frontend
        df["education_type"] = df.apply(classify_education_type, axis=1)
        
        # 3. Zamieniamy wszystkie wartości NaN na None (JSON obsługuje None jako null)
        df = df.replace({np.nan: None})
        
        data = df.to_dict(orient='records')
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

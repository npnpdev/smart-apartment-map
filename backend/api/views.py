import os
import pandas as pd
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# --- KONFIGURACJA ---
DATA_DIR_NAME = 'data'
SAFETY_FILENAME = 'bezpieczenstwo_gdansk.csv'
APARTMENTS_FILENAME = 'mieszkania.csv'  # <--- NOWA STAŁA

"""
Prywatna funkcja pomocnicza budująca absolutną ścieżkę do pliku danych.
"""
def _get_data_file_path(filename):
    return os.path.join(settings.BASE_DIR, DATA_DIR_NAME, filename)

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
    file_path = _get_data_file_path(APARTMENTS_FILENAME)
    
    if not os.path.exists(file_path):
        return Response(
            {"error": "Źródło danych mieszkań (plik CSV) nie zostało znalezione."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Wczytujemy dane
        df = pd.read_csv(file_path)
        
        # Konwersja DataFrame na format JSON (lista słowników)
        data = df.to_dict(orient='records')
        
        return Response(data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {"error": "Wystąpił błąd podczas przetwarzania danych mieszkań.", "details": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
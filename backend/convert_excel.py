import pandas as pd
import os

def convert_crime_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(base_dir, 'data', 'przestepstwa.xlsx')
    output_file = os.path.join(base_dir, 'data', 'bezpieczenstwo_gdansk.csv')
    
    print(f"Wczytywanie pliku: {input_file}...")
    
    try:
        # 1. Wczytujemy OSTATNI arkusz (czyli rok 2023), niezależnie od literówek w nazwie
        # skiprows=3 -> pomijamy 3 pierwsze wiersze (tytuły), żeby trafić w nagłówki tabeli (DZIELNICA itp.)
        # usecols="B,E" -> Bierzemy kolumnę B (Dzielnica) i E (Przestępstwa na 1000 mieszkańców)
        # nrows=35 -> Bierzemy 35 wierszy danych (tyle jest dzielnic), żeby nie wziąć podsumowania z dołu
        
        df = pd.read_excel(
            input_file, 
            sheet_name=-1,  # -1 oznacza ostatni arkusz w pliku
            skiprows=3, 
            usecols="B,E",
            nrows=35 
        )
        
        # 2. Nadajemy nasze nazwy kolumn
        df.columns = ['dzielnica', 'wskaznik_przestepstw']
        
        print("Udało się wczytać dane! Przykładowy wiersz:")
        print(df.head(1))
        
        # 3. Naprawiamy liczby (zamiana przecinka na kropkę)
        if df['wskaznik_przestepstw'].dtype == 'object':
            df['wskaznik_przestepstw'] = df['wskaznik_przestepstw'].astype(str).str.replace(',', '.').astype(float)
            
        # 4. Zapisujemy gotowy CSV
        df.to_csv(output_file, index=False, encoding='utf-8')
        print(f"\nSUKCES! Utworzono plik: {output_file}")
        
    except Exception as e:
        print(f"KURDE, ZNOWU BŁĄD: {e}")

if __name__ == "__main__":
    convert_crime_data()
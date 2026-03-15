import pandas as pd
import geopandas as gpd

print("Wczytywanie...")
df = pd.read_csv('data/mieszkania.csv')

gdf_mieszkania = gpd.GeoDataFrame(
    df, geometry=gpd.points_from_xy(df.lng, df.lat), crs="EPSG:4326"
)

# Czyta plik, który przed chwilą skopiowałeś do folderu backendu
gdf_dzielnice = gpd.read_file('data/gdansk_dzielnice.geojson')
if gdf_dzielnice.crs != "EPSG:4326":
    gdf_dzielnice = gdf_dzielnice.to_crs("EPSG:4326")

print("Dopasowywanie do mapy...")
wynik = gpd.sjoin(gdf_mieszkania, gdf_dzielnice, how="left", predicate="within")

if 'name_right' in wynik.columns:
    df['district'] = wynik['name_right']
elif 'nazwa_right' in wynik.columns:
    df['district'] = wynik['nazwa_right']

df['district'] = df['district'].fillna('Poza miastem')
df.to_csv('data/mieszkania.csv', index=False)
print("Gotowe!")

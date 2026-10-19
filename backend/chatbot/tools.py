"""Narzedzia (tool use) dla chatbota: odczyt mieszkan i statystyk dzielnic.

Model podaje tylko parametry w JSON; zapytania buduje ORM przez istniejacy
ApartmentFilter
"""

from django.contrib.gis.measure import D
from django.db.models import Avg, Count, F, OuterRef, Q, Subquery
from rest_framework.serializers import ValidationError

from api.filters import ApartmentFilter, latest_crimes_per_1000, uprosc
from api.models import Apartment, District, EducationFacility, SafetyData

MAX_RESULTS = 10
DEFAULT_RESULTS = 5
NEARBY_EDU_KM = 1

# WHO Environmental Noise Guidelines (2018), halas drogowy: 53 dB Lden
WHO_ROAD_NOISE_DB = 53

EDU_TYPES = ["Przedszkola", "Podstawowe", "Średnie", "Uczelnie"]
EDU_COUNT_KEYS = {
    "kindergarten": "przedszkola",
    "primary": "podstawowe",
    "secondary": "srednie",
    "university": "uczelnie",
}

SEARCH_TOOL = {
    "name": "search_apartments",
    "description": (
        "Wyszukuje aktualne oferty mieszkań na wynajem w Gdańsku z bazy aplikacji. "
        "Zwraca łączną liczbę pasujących ofert i kilka najtańszych, każdą z danymi "
        "o okolicy (hałas, przestępczość w dzielnicy, szkoły w promieniu 1 km). "
        "Używaj, gdy użytkownik pyta o konkretne mieszkania lub chce zobaczyć przykłady."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "district": {
                "type": "string",
                "description": (
                    "Nazwa dzielnicy w mianowniku, np. 'Oliwa'. Może być ogólna, np. 'Wrzeszcz' "
                    "obejmie Wrzeszcz Górny i Dolny."
                ),
            },
            "price_min": {"type": "number", "description": "Minimalny czynsz w PLN."},
            "price_max": {"type": "number", "description": "Maksymalny czynsz w PLN."},
            "area_min": {"type": "number", "description": "Minimalny metraż w m²."},
            "area_max": {"type": "number", "description": "Maksymalny metraż w m²."},
            "rooms_min": {"type": "integer", "description": "Minimalna liczba pokoi."},
            "rooms_max": {"type": "integer", "description": "Maksymalna liczba pokoi."},
            "noise_max": {"type": "number", "description": "Maksymalny hałas w dB."},
            "safety_max": {"type": "number", "description": "Maks. przestępstw na 1000 mieszkańców w dzielnicy."},
            "edu_types": {
                "type": "array",
                "items": {"type": "string", "enum": EDU_TYPES},
                "description": "Wymagane placówki w pobliżu (wszystkie naraz).",
            },
            "edu_radius": {"type": "number", "description": "Promień dla edu_types w km."},
            "limit": {"type": "integer", "description": f"Ile ofert zwrócić (1–{MAX_RESULTS})."},
        },
    },
}

DISTRICT_STATS_TOOL = {
    "name": "get_district_stats",
    "description": (
        "Zwraca statystyki dzielnicy Gdańska: liczbę ofert, średni czynsz i cenę za m², "
        "wskaźnik przestępczości na tle miasta, liczbę szkół i przedszkoli. "
        "Używaj, gdy użytkownik pyta o dzielnicę lub chce porównać dzielnice."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "district": {"type": "string", "description": "Nazwa dzielnicy."},
        },
        "required": ["district"],
    },
}


def base_queryset():
    return Apartment.objects.filter(is_active=True, validation_status="valid")


def district_names():
    return list(District.objects.order_by("name").values_list("name", flat=True))


def find_districts(name):
    """Dokładna nazwa albo wszystkie dzielnice zawierające podaną frazę
    (bez polskich znaków), np. 'wrzeszcz' -> Wrzeszcz Górny + Wrzeszcz Dolny."""
    fraza = uprosc(name)
    if not fraza:
        return []
    districts = list(District.objects.order_by("name"))
    exact = [d for d in districts if uprosc(d.name) == fraza]
    return exact or [d for d in districts if fraza in uprosc(d.name)]


def unknown_district(name):
    return {
        "error": f"Nie rozpoznano dzielnicy '{name}'.",
        "dostepne_dzielnice": district_names(),
        "wskazowka": (
            "Nie mów użytkownikowi o bazie ani liście. Dopasuj sam najbliższą nazwę "
            "i wyszukaj ponownie albo naturalnie dopytaj, o którą okolicę chodzi."
        ),
    }


def city_avg_crimes():
    latest = SafetyData.objects.order_by("-year").values_list("year", flat=True).first()
    if latest is None:
        return None
    avg = SafetyData.objects.filter(year=latest).aggregate(v=Avg("crimes_per_1000"))["v"]
    return round(float(avg), 2) if avg is not None else None


def noise_assessment(db):
    if db is None:
        return "brak danych o hałasie"
    if db <= WHO_ROAD_NOISE_DB:
        return f"poniżej zalecenia WHO dla hałasu drogowego ({WHO_ROAD_NOISE_DB} dB)"
    if db <= 65:
        return f"powyżej zalecenia WHO ({WHO_ROAD_NOISE_DB} dB), umiarkowany"
    return f"wysoki, wyraźnie powyżej zalecenia WHO ({WHO_ROAD_NOISE_DB} dB)"


def safety_assessment(rate, city_avg):
    if rate is None:
        return "brak danych o przestępczości"
    if city_avg is None:
        return f"{rate} przestępstw na 1000 mieszkańców"
    if rate <= city_avg * 0.75:
        poziom = "wyraźnie bezpieczniej niż średnia miasta"
    elif rate <= city_avg:
        poziom = "nieco bezpieczniej niż średnia miasta"
    elif rate <= city_avg * 1.25:
        poziom = "nieco powyżej średniej miasta"
    else:
        poziom = "wyraźnie powyżej średniej miasta"
    return f"{rate} na 1000 mieszkańców ({poziom}: {city_avg})"


def nearby_education(location):
    counts = (
        EducationFacility.objects.filter(location__dwithin=(location, D(km=NEARBY_EDU_KM)))
        .values("facility_type")
        .annotate(n=Count("id"))
    )
    wynik = {klucz: 0 for klucz in EDU_COUNT_KEYS.values()}
    for row in counts:
        klucz = EDU_COUNT_KEYS.get(row["facility_type"])
        if klucz:
            wynik[klucz] = row["n"]
    return wynik


def describe_apartment(apt, city_avg):
    rate = float(apt.crimes_per_1000) if apt.crimes_per_1000 is not None else None
    return {
        "id": apt.id,
        "tytul": apt.title,
        "adres": apt.address or None,
        "dzielnica": apt.district.name if apt.district else None,
        "czynsz_pln": float(apt.price),
        "metraz_m2": float(apt.area),
        "pokoje": apt.rooms,
        "pietro": apt.floor,
        "rok_budowy": apt.year_built,
        "winda": apt.has_elevator,
        "halas_db": apt.noise_db_max,
        "halas_ocena": noise_assessment(apt.noise_db_max),
        "przestepczosc_ocena": safety_assessment(rate, city_avg),
        f"placowki_w_promieniu_{NEARBY_EDU_KM}_km": nearby_education(apt.location),
        "link": apt.source_url or None,
    }


def search_apartments(args):
    base = base_queryset()
    districts = []
    if args.get("district"):
        districts = find_districts(args["district"])
        if not districts:
            return unknown_district(args["district"])
        base = base.filter(district__in=districts)

    params = {
        key: args[key]
        for key in (
            "price_min", "price_max", "area_min", "area_max",
            "rooms_min", "rooms_max", "noise_max", "safety_max", "edu_radius",
        )
        if args.get(key) is not None
    }
    if args.get("edu_types"):
        params["edu_types"] = ",".join(args["edu_types"])

    filterset = ApartmentFilter(data=params, queryset=base)
    if not filterset.is_valid():
        return {"error": "Niepoprawne parametry.", "szczegoly": filterset.errors}
    try:
        qs = filterset.qs
    except ValidationError as e:
        return {"error": "Niepoprawne parametry.", "szczegoly": e.detail}

    try:
        limit = int(args.get("limit") or DEFAULT_RESULTS)
    except (TypeError, ValueError):
        limit = DEFAULT_RESULTS
    limit = max(1, min(limit, MAX_RESULTS))

    total = qs.count()
    # filtr safety_max mogl juz dodac te adnotacje
    if "crimes_per_1000" not in qs.query.annotations:
        qs = qs.annotate(
            crimes_per_1000=Subquery(latest_crimes_per_1000(OuterRef("district")))
        )
    apartments = qs.select_related("district").order_by("price")[:limit]
    city_avg = city_avg_crimes()
    return {
        "dzielnice": [d.name for d in districts] or "cały Gdańsk",
        "liczba_pasujacych": total,
        "pokazane": [describe_apartment(apt, city_avg) for apt in apartments],
    }


def get_district_stats(args):
    districts = find_districts(args.get("district"))
    if not districts:
        return unknown_district(args.get("district"))
    if len(districts) > 1:
        return {"dzielnice": [district_stats(d) for d in districts[:4]]}
    return district_stats(districts[0])


def district_stats(district):
    oferty = base_queryset().filter(district=district).aggregate(
        liczba=Count("id"),
        sredni_czynsz=Avg("price"),
        srednia_za_m2=Avg(F("price") / F("area"), filter=Q(area__gt=0)),
        sredni_halas=Avg("noise_db_max"),
    )
    safety = district.safety_records.order_by("-year").first()
    rate = float(safety.crimes_per_1000) if safety else None
    placowki = (
        district.education_facilities.values("facility_type").annotate(n=Count("id"))
    )
    edu = {klucz: 0 for klucz in EDU_COUNT_KEYS.values()}
    for row in placowki:
        klucz = EDU_COUNT_KEYS.get(row["facility_type"])
        if klucz:
            edu[klucz] = row["n"]

    def zaokraglij(v):
        return round(float(v)) if v is not None else None

    sredni_halas = zaokraglij(oferty["sredni_halas"])
    return {
        "dzielnica": district.name,
        "liczba_ofert": oferty["liczba"],
        "sredni_czynsz_pln": zaokraglij(oferty["sredni_czynsz"]),
        "sredni_czynsz_za_m2_pln": zaokraglij(oferty["srednia_za_m2"]),
        "sredni_halas_db": sredni_halas,
        "halas_ocena": noise_assessment(sredni_halas),
        "przestepczosc_ocena": safety_assessment(rate, city_avg_crimes()),
        "rok_statystyk": safety.year if safety else None,
        "placowki_edukacyjne": edu,
    }


DATA_TOOLS = {
    "search_apartments": search_apartments,
    "get_district_stats": get_district_stats,
}

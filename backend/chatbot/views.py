import json

import anthropic
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tools import DATA_TOOLS, DISTRICT_STATS_TOOL, SEARCH_TOOL

FILTER_TOOL = {
    "name": "set_apartment_filters",
    "description": (
        "Ustawia filtry na mapie mieszkań na podstawie preferencji użytkownika. "
        "Wywołaj gdy użytkownik opisuje czego szuka w mieszkaniu lub okolicy. "
        "Ustaw tylko te parametry, które wynikają z opisu — reszta pozostaje bez zmian."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "safety_threshold": {
                "type": "number",
                "description": (
                    "Maksymalny wskaźnik przestępstw na 1000 mieszkańców. "
                    "Niższa wartość = bezpieczniejsze dzielnice. W Gdańsku zakres ok. 11–180, "
                    "średnia miasta ok. 34; 'bezpiecznie' to mniej więcej 25."
                ),
            },
            "noise_threshold": {
                "type": "number",
                "description": (
                    "Maksymalny poziom hałasu w dB. "
                    "45 = bardzo cicho, 60 = umiarkowanie, 80 = bez limitu."
                ),
            },
            "edu_types": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["Przedszkola", "Podstawowe", "Średnie", "Uczelnie"],
                },
                "description": "Typy placówek edukacyjnych wymaganych w pobliżu mieszkania.",
            },
            "edu_radius": {
                "type": "number",
                "description": "Promień wyszukiwania placówek edukacyjnych w km (np. 0.5, 1.0, 2.0).",
            },
        },
    },
}

SYSTEM_PROMPT = """Jesteś pomocnym asystentem aplikacji Smart Apartment Map — interaktywnej mapy mieszkań na wynajem w Gdańsku.
Pomagasz użytkownikom znaleźć mieszkania dopasowane do ich stylu życia: ustawiasz filtry na mapie i opisujesz konkretne oferty oraz dzielnice.

Filtry mapy (narzędzie set_apartment_filters):
- Bezpieczeństwo (safety_threshold): wskaźnik przestępstw/1000 mieszkańców — im niższy, tym bezpieczniej
- Hałas (noise_threshold): maks. poziom w dB — 45 to cisza, 80 to brak limitu
- Edukacja (edu_types): placówki w pobliżu — Przedszkola, Podstawowe, Średnie, Uczelnie
- Promień edukacji (edu_radius): zasięg w km, w którym szukamy tych placówek

Dane z bazy:
- search_apartments: konkretne oferty z danymi o okolicy
- get_district_stats: statystyki dzielnicy

Zasady działania:
- Gdy użytkownik opisuje preferencje, wywołaj set_apartment_filters z pasującymi wartościami i search_apartments z odpowiadającymi kryteriami (także cena, metraż, pokoje, dzielnica)
- Ustaw tylko filtry, które wynikają z opisu — nie zmieniaj pozostałych
- Opisując ofertę, łącz dane z kilku źródeł w zwięzły opis, np. "Oliwa, ul. Lipowa 45, 2 pokoje, 2800 zł: spokojna lokalizacja, hałas poniżej zalecenia WHO, bezpieczniej niż średnia miasta, 2 przedszkola w promieniu 1 km."
- Korzystaj wyłącznie z danych zwróconych przez narzędzia; oceny hałasu i bezpieczeństwa przepisuj z pól *_ocena, nie wymyślaj własnych norm
- Nie masz danych o komunikacji, sklepach, zdjęciach ani stanie technicznym — jeśli ktoś o to pyta, powiedz to wprost
- Jeśli nic nie pasuje, powiedz to i zaproponuj, które kryterium poluzować
- Jeśli pytanie jest ogólne (np. "co tu można znaleźć?"), odpowiedz bez wywoływania narzędzi
- Bądź zwięzły: krótki wstęp i maksymalnie 3 opisane oferty

Styl rozmowy:
- Pisz naturalnie, jak doradca, który zna Gdańsk — nie jak program czytający bazę danych
- Nigdy nie wspominaj o bazie, narzędziach, wyszukiwaniu, parametrach ani polach danych (np. "w bazie znajduje się", "sprawdzę w systemie", "narzędzie zwróciło")
- Nie komentuj, jak zinterpretowałeś pytanie; po prostu odpowiedz
- Gdy ktoś poda ogólną okolicę (np. "Wrzeszcz"), traktuj ją jako całość; jeśli wyniki obejmują kilka dzielnic, wymień je zwyczajnie przy ofertach
- Liczby podawaj po ludzku, np. "Znalazłem 32 mieszkania, oto 3 najtańsze"
- Gdy czegoś nie wiesz albo brakuje danych, powiedz to krótko i bez technicznych wyjaśnień"""

MODEL = "claude-haiku-4-5-20251001"
MAX_TOOL_ROUNDS = 5


def run_tool(name, args):
    handler = DATA_TOOLS.get(name)
    if handler is None:
        return {"error": f"Nieznane narzędzie: {name}"}
    return handler(args)


@api_view(["POST"])
@permission_classes([AllowAny])
def chat(request):
    message = request.data.get("message", "").strip()
    history = request.data.get("history", [])

    if not message:
        return Response({"error": "Brak wiadomości"}, status=status.HTTP_400_BAD_REQUEST)

    if not settings.ANTHROPIC_API_KEY:
        return Response({"error": "Brak klucza API"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    messages = [*history, {"role": "user", "content": message}]

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    filters = None
    apartment_ids = []
    reply_text = ""

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            api_response = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                tools=[FILTER_TOOL, SEARCH_TOOL, DISTRICT_STATS_TOOL],
                messages=messages,
            )

            tool_results = []
            for block in api_response.content:
                if block.type == "text":
                    reply_text = block.text
                elif block.type == "tool_use":
                    if block.name == "set_apartment_filters":
                        filters = block.input
                        result = {"ok": True}
                    else:
                        result = run_tool(block.name, block.input)
                        for apt in result.get("pokazane", []):
                            if apt["id"] not in apartment_ids:
                                apartment_ids.append(apt["id"])
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                        "is_error": "error" in result,
                    })

            if api_response.stop_reason != "tool_use":
                break

            messages.append({
                "role": "assistant",
                "content": [b.model_dump(exclude_none=True) for b in api_response.content],
            })
            messages.append({"role": "user", "content": tool_results})
    except anthropic.APIError:
        return Response(
            {"error": "Asystent jest chwilowo niedostępny. Spróbuj ponownie."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if not reply_text:
        reply_text = "Filtry zostały zaktualizowane na mapie."

    return Response({"reply": reply_text, "filters": filters, "apartment_ids": apartment_ids})

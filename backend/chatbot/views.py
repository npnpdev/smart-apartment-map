import anthropic
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

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
                    "Niższa wartość = bezpieczniejsze dzielnice. Typowy zakres 2–20."
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

SYSTEM_PROMPT = """Jesteś pomocnym asystentem aplikacji Smart Apartment Map — interaktywnej mapy mieszkań w Gdańsku.
Pomagasz użytkownikom znaleźć mieszkania dopasowane do ich stylu życia, ustawiając filtry na mapie.

Dostępne filtry:
- Bezpieczeństwo (safety_threshold): wskaźnik przestępstw/1000 mieszkańców — im niższy, tym bezpieczniej
- Hałas (noise_threshold): maks. poziom w dB — 45 to cisza, 80 to brak limitu
- Edukacja (edu_types): placówki w pobliżu — Przedszkola, Podstawowe, Średnie, Uczelnie
- Promień edukacji (edu_radius): zasięg w km, w którym szukamy tych placówek

Zasady działania:
- Gdy użytkownik opisuje preferencje, wywołaj narzędzie set_apartment_filters z pasującymi wartościami
- Ustaw tylko filtry, które wynikają z opisu — nie zmieniaj pozostałych
- Po wywołaniu narzędzia odpowiedz krótko po polsku, co ustawiłeś i dlaczego
- Jeśli pytanie jest ogólne (np. "co tu można znaleźć?"), odpowiedz bez wywoływania narzędzia
- Bądź zwięzły — 1–3 zdania wystarczą"""


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
    api_response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        tools=[FILTER_TOOL],
        messages=messages,
    )

    filters = None
    reply_text = ""

    for block in api_response.content:
        if block.type == "tool_use" and block.name == "set_apartment_filters":
            filters = block.input
        elif block.type == "text":
            reply_text = block.text

    if not reply_text:
        reply_text = "Filtry zostały zaktualizowane na mapie."

    return Response({"reply": reply_text, "filters": filters})

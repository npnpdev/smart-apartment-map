# Rozmiary czcionek

Aplikacja obsługuje trzy rozmiary tekstu, które użytkownik może zmieniać w czasie rzeczywistym. Ustawienie jest zapamiętywane między sesjami.

## Dostępne rozmiary

| Wartość | Bazowy rozmiar | Zastosowanie |
|---|---|---|
| `normal` | 16px | domyślny |
| `large` | 20px | ułatwia czytanie |
| `xlarge` | 24px | tryb dostępności |

## Jak to działa

Rozmiar przechowywany jest w `AppContext` jako stan typu `FontSize`. Zmiana powoduje aktualizację zmiennej CSS `--font-size-base` na elemencie `<html>`.

```ts
type FontSize = "normal" | "large" | "xlarge";
```

```ts
// AppContext – efekt uboczny przy zmianie rozmiaru
useEffect(() => {
  document.documentElement.style.setProperty("--font-size-base", FONT_SIZES[fontSize]);
  localStorage.setItem("fontSize", fontSize);
}, [fontSize]);
```

Przy starcie aplikacji wartość odczytywana jest synchronicznie z `localStorage`, więc nie ma efektu migotania (flash):

```ts
const [fontSize, setFontSize] = useState<FontSize>(
  () => (localStorage.getItem("fontSize") as FontSize) || "normal"
);
```

## Użycie w CSS

Komponenty powinny używać zmiennej zamiast stałych wartości:

```css
font-size: var(--font-size-base);     /* 16 / 20 / 24 px */
font-size: calc(var(--font-size-base) * 0.875); /* skalowanie względne */
```

!!! tip "Dostępność"
    Opcja `xlarge` jest przeznaczona dla użytkowników z wadami wzroku lub korzystających z ekranów dotykowych. Nie należy jej usuwać nawet jeśli nie jest uwzględniona w projekcie graficznym.

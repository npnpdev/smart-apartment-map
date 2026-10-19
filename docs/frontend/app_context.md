# AppContext — globalny stan aplikacji

`AppContext`

## Co przechowuje

| Pole             | Typ                               | Opis                                                    |
| ---------------- | --------------------------------- | ------------------------------------------------------- |
| `email`          | `string \| null`                  | e-mail zalogowanego użytkownika; `null` = niezalogowany |
| `setEmail`       | `(v: string \| null) => void`     | logowanie / wylogowanie                                 |
| `cities`         | `City[]`                          | lista dostępnych miast (Gdańsk, Gdynia, Sopot)          |
| `currentCity`    | `City`                            | aktualnie wybrane miasto                                |
| `changeCity`     | `(name: string) => void`          | zmiana miasta na mapie                                  |
| `fontSize`       | `"normal" \| "large" \| "xlarge"` | aktualny rozmiar czcionki                               |
| `setFontSize`    | `(v: FontSize) => void`           | zmiana rozmiaru                                         |
| `favorites`      | `Map<number, FavoriteItem>`       | ulubione mieszkania zalogowanego użytkownika            |
| `toggleFavorite` | `(item: FavoriteItem) => void`    | dodaj / usuń z ulubionych                               |
| `isFavorite`     | `(id: number) => boolean`         | sprawdź czy mieszkanie jest w ulubionych                |

## Odczyt zapamiętanych danych z localStorage przy starcie

Oba kluczowe stany (`email` i `favorites`) są inicjalizowane **synchronicznie** z `localStorage`.

```ts
const [email, setEmailRaw] = useState<string | null>(() =>
  localStorage.getItem("userEmail"),
);

const [favorites, setFavorites] = useState<Map<number, FavoriteItem>>(() => {
  const saved = localStorage.getItem("userEmail");
  if (!saved) return new Map();
  const stored = localStorage.getItem(`favorites_${saved}`);
  const items: FavoriteItem[] = stored ? JSON.parse(stored) : [];
  return new Map(items.map((item) => [item.id, item]));
});
```

---

## System ulubionych

### Typ danych

```ts
export type FavoriteItem = {
  id: number;
  name: string;
  district: string | null;
  price: number;
  noise_db?: string;
};
```

Dane mieszkania są zapisywane **w momencie polubienia** (w `BuildingCard`), więc strona `Ulubione` może działać bez ponownego odpytywania API.

### Klucze localStorage

Każdy użytkownik ma **osobny** klucz, co gwarantuje izolację danych:

```
favorites_jan@example.com
favorites_anna@example.com
```

Dzięki temu po zalogowaniu innym kontem widać wyłącznie własne polubienia.

### Cykl życia

| Akcja              | Efekt                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Użytkownik klika ♡ | `toggleFavorite(item)` — dodaje lub usuwa z `Map`, zapisuje do `localStorage`   |
| Zalogowanie        | `setEmail(email)` ładuje `favorites_${email}` z `localStorage` do stanu         |
| Wylogowanie        | `setEmail(null)` czyści stan `favorites` i usuwa `"userEmail"` z `localStorage` |
| Odświeżenie strony | synchroniczny `useState` initializer odczytuje dane bez efektu flash            |

### Strona Ulubionych

`MostLiked.tsx`— odczytuje `[...favorites.values()]` kontekstu. Dzięki temu wyświetlanie jest natychmiastowe.

!!! note "Dostęp tylko dla zalogowanych"
Niezalogowany użytkownik widzi ekran blokady z zachętą do rejestracji. Przycisk ♡ na kartach mapy przekierowuje do `/login`.

---

## Auto-wylogowanie po braku aktywności

Użytkownik jest automatycznie wylogowywany po **30 minutach bez aktywności**.

### Śledzone zdarzenia

| Zdarzenie    | Kiedy                             |
| ------------ | --------------------------------- |
| `mousedown`  | kliknięcie myszą                  |
| `keydown`    | naciśnięcie klawisza              |
| `scroll`     | przewijanie strony                |
| `touchstart` | dotknięcie na urządzeniu mobilnym |

### Mechanizm

```ts
useEffect(() => {
  if (!email) return; // działa tylko gdy użytkownik jest zalogowany

  const TIMEOUT_MS = 30 * 60 * 1000;
  let timer: ReturnType<typeof setTimeout>;

  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      localStorage.removeItem("userEmail");
      setFavorites(new Map());
      setEmailRaw(null);
    }, TIMEOUT_MS);
  };

  const events = ["mousedown", "keydown", "scroll", "touchstart"];
  events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
  reset(); // startuje timer od razu po zalogowaniu

  return () => {
    clearTimeout(timer);
    events.forEach((e) => window.removeEventListener(e, reset));
  };
}, [email]);
```

!!! warning "Ważne"
Przy ręcznym wylogowaniu timer jest anulowany natychmiast. Nie ma ryzyka podwójnego wylogowania.

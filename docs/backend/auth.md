# 🔐 Konto użytkownika: reset hasła i usuwanie

Notatka dla frontendu. Wszystkie endpointy leżą pod `/api/auth/`, przyjmują i zwracają JSON.

## 🔑 Reset hasła

Przepływ: użytkownik podaje email → backend wysyła maila z linkiem → link otwiera stronę frontendu → frontend wysyła nowe hasło razem z `uid` i `token` wyciągniętymi z adresu.

### 1. Prośba o link

`POST /api/auth/password-reset/` — bez logowania.

```json
{ "email": "jan@example.com" }
```

| Kod | Kiedy | Treść |
|---|---|---|
| `200` | zawsze, gdy email ma poprawny format | `{ "detail": "Jeśli konto o tym adresie istnieje, wysłaliśmy link do resetu hasła." }` |
| `400` | niepoprawny format emaila | `{ "email": ["..."] }` |

Odpowiedź jest **identyczna** dla istniejącego i nieistniejącego konta — celowo, żeby nie dało się sprawdzić, kto ma u nas konto. Frontend powinien po prostu pokazać ten komunikat.

### 2. Link w mailu

```
{FRONTEND_URL}/reset-password/<uid>/<token>
```

`FRONTEND_URL` domyślnie to `http://localhost:5173`. Frontend musi mieć route `/reset-password/:uid/:token`, która pokazuje formularz nowego hasła. Link jest ważny **1 godzinę** (`PASSWORD_RESET_TIMEOUT`) i działa **jednorazowo** — po zmianie hasła wygasa sam.

### 3. Ustawienie nowego hasła

`POST /api/auth/password-reset/confirm/` — bez logowania.

```json
{ "uid": "MQ", "token": "cz8k1a-3f2b...", "new_password": "Nowe-Haslo-Oliwa-77" }
```

| Kod | Kiedy | Treść |
|---|---|---|
| `200` | hasło zmienione | `{ "detail": "Hasło zostało zmienione." }` |
| `400` | link zły, użyty lub wygasły | `{ "token": ["Link resetujący jest nieprawidłowy lub wygasł."] }` |
| `400` | hasło nie przechodzi walidatorów (za krótkie, popularne, same cyfry, podobne do emaila) | `{ "new_password": ["...", "..."] }` |

Po `200` użytkownik **nie** jest zalogowany — trzeba przekierować go na logowanie.

## 🗑️ Usuwanie konta

`DELETE /api/auth/me/` — wymaga `Authorization: Bearer <access>`. Hasło w body jako potwierdzenie:

```json
{ "password": "aktualne-haslo" }
```

| Kod | Kiedy | Treść |
|---|---|---|
| `204` | konto usunięte | brak |
| `400` | złe lub brakujące hasło | `{ "password": ["Nieprawidłowe hasło."] }` |
| `401` | brak / nieważny token | — |

```js
await fetch("http://localhost:8000/api/auth/me/", {
  method: "DELETE",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ password }),
});
```

Po `204` frontend powinien wylogować użytkownika (wyczyścić `AccessToken`, `userEmail` i `favorites_<email>` z `localStorage`).

### Co dzieje się w bazie (soft delete)

Wiersz użytkownika **zostaje**, ale jest od razu anonimizowany:

- `email` → `deleted_<id>@deleted.invalid`, `username` → `deleted_<id>`, imię i nazwisko czyszczone,
- `is_active = False`, ustawione `deleted_at`, hasło zamienione na nieużywalne, odebrane uprawnienia admina.

Skutki:

- wszystkie wydane tokeny JWT przestają działać od razu (simplejwt odrzuca nieaktywnych użytkowników przy każdym żądaniu),
- konta **nie da się przywrócić** — ani logowaniem, ani resetem hasła,
- ten sam email i username można od razu zarejestrować ponownie (powstaje nowe konto),
- powiązane dane (`FavoriteApartment`) zostają przypięte do zanonimizowanego wiersza,
- rejestracja odrzuca emaile kończące się na `@deleted.invalid` i nazwy zaczynające się od `deleted_`, żeby nikt nie zajął z wyprzedzeniem nazwy, którą dostanie usuwane konto.

## 📬 Maile w środowisku dev

Backend wysyła maile przez SMTP do kontenera **Mailpit** (`mailpit:1025`). Skrzynka jest pod <http://localhost:8025> — tam widać maila z linkiem resetującym. Jeśli serwer pocztowy nie odpowiada, endpoint i tak zwraca `200`, a błąd ląduje w `docker compose logs backend`.

Na produkcji wystarczy podmienić zmienne w `.env`: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL`.

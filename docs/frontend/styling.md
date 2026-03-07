# 🎨 Stylizacja i Motywy

Projekt wykorzystuje nowoczesny styl **Glassmorphism** oraz w pełni dynamiczny **Dark Mode**. Cała paleta kolorów oparta jest na zmiennych CSS, co pozwala na natychmiastową zmianę motywu.

## 🌙 Tryb Ciemny (Dark Mode)

System wykrywa klasę `dark-theme` na elemencie `<body>`. Przełączanie odbywa się w komponencie nawigacji (`MainNavigation.tsx`).

### Zmienne kolorystyczne (`index.css`)

Używamy zmiennych CSS, aby komponenty automatycznie dostosowywały się do motywu.

| Zmienna | Opis | Wartość Light | Wartość Dark |
| :--- | :--- | :--- | :--- |
| `--bg-base` | Główne tło strony | `#ebe7df` (Beż) | `#101010` (Grafit) |
| `--glass-bg` | Tło paneli (Szkło) | `rgba(255, 251, 245, 0.72)` | `rgba(24, 24, 24, 0.72)` |
| `--text-primary` | Główny tekst | `#181716` | `#f3f3f1` |
| `--accent` | Akcenty/Przyciski | `#2c2926` | `#f3f3f1` |

!!! warning "Ważne"
    Nie używaj sztywnych kolorów HEX (np. `#ffffff`) w komponentach! Zawsze używaj `var(--nazwa-zmiennej)`, aby tryb ciemny działał poprawnie.

## 💎 Glassmorphism

Aby uzyskać efekt "mlecznego szkła", używamy kombinacji tła z kanałem alpha oraz filtru rozmycia.

```css title="Przykład klasy CSS"
.glass-panel {
  background: var(--glass-bg-strong); /* Półprzezroczyste tło */
  backdrop-filter: var(--blur);       /* Rozmycie tego co pod spodem (blur 18px) */
  border: 1px solid var(--border);    /* Subtelna krawędź */
  border-radius: var(--radius-xl);    /* Zaokrąglenie 32px */
  box-shadow: var(--shadow-medium);   /* Cień */
}```

## 🧩 Gotowe Komponenty

W projekcie zdefiniowane są również promienie zaokrągleń (`border-radius`):

*   `--radius-sm`: 10px
*   `--radius-md`: 18px
*   `--radius-lg`: 28px
*   `--radius-xl`: 32px
*   `--radius-pill`: 999px (W pełni zaokrąglone, np. przyciski)
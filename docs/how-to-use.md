# 📘 Jak korzystać z dokumentacji

Ta dokumentacja jest zbudowana z wykorzystaniem **[MkDocs Material](https://squidfunk.github.io/mkdocs-material/)** oraz rozszerzeń **[Pymdown Extensions](https://facelessuser.github.io/pymdown-extensions/)**, które rozszerzają możliwości zwykłego Markdowna.  
Ten przewodnik pokazuje, jak korzystać z dostępnych funkcji do tworzenia dokumentacji.

---

## 🔗 Dodanie strony do nawigacji

W pliku `mkdocs.yml` znajdz `nav:` i dodaj wpis:

```yaml
nav:
  - nazwa_w_menu: nazwa_pliku.md
  - inna_nazwa_w_menu: inna_nazwa_pliku.md
```

---

## 📣 Upomnienia (Admonitions)

Bloki informacji pomagają zwrócić uwagę na ważne komunikaty: notatki, porady, ostrzeżenia, itp.

```md
!!! note
    To jest zwykła notatka.

!!! warning "Uwaga!"
    To jest ostrzeżenie z niestandardowym tytułem.

!!! tip
    To jest przydatna wskazówka.

```

**Efekt:**

!!! note
    To jest zwykła notatka.

!!! warning "Uwaga!"
    To jest ostrzeżenie z niestandardowym tytułem.

!!! tip
    To jest przydatna wskazówka.


Dzięki `pymdownx.details` możesz tworzyć **rozwijane sekcje**, które pozwalają ukrywać mniej istotne informacje.

```md
??? info "Kliknij, aby rozwinąć"
    Ten tekst jest widoczny dopiero po kliknięciu.
```

**Efekt:**

??? info "Kliknij, aby rozwinąć"
    Ten tekst jest widoczny dopiero po kliknięciu.

Sekcję można też otworzyć domyślnie:

```md
???+ note "Domyślnie otwarte"
    Ta sekcja jest otwarta od razu.
```

**Efekt:**

???+ note "Domyślnie otwarte"
    Ta sekcja jest otwarta od razu.

[❕️  Więcej na temat upomnienia](https://squidfunk.github.io/mkdocs-material/reference/admonitions/)

---

## 💻 Bloki kodu

Kod otacza się trzema backtickami (```` ``` ````) i nazwą języka.

```` ``` ````
def hello(name):
    print(f"Hello, {name}!")
```` ``` ````

**Efekt:**

```
def hello(name):
    print(f"Hello, {name}!")  # ta linia zostanie podświetlona
```
Aby dodać podświetlanie składni, należy określić język (tzw. lexer Pygments).
```` ``` ```` python
def hello(name):
    print(f"Hello, {name}!")
```` ``` ````

**Efekt:**

```python
def hello(name):
    print(f"Hello, {name}!")  # ta linia zostanie podświetlona
```
[❕️  Więcej na temat pygments](https://pygments.org/docs/lexers/)

Dodatkowe ciekawe efekty(podkreślenie kodu, ponumerowane linie kodu, tytuł):
title="Example" linenums="1" hl_lines="3-4"

**Efekt:**
```python title="Example" linenums="1" hl_lines="3-4"
def hello(name):
    print(f"Hello, {name}!")  # ta linia zostanie podświetlona
    print("Podkresl to")
    print("i to")
```

Możesz też grupować różne języki w **zakładkach** dzięki `pymdownx.superfences`:

```
=== "Python"
    ``` python print("Hello world")
    ```

=== "JavaScript"
    ``` js console.log("Hello world");
    ```
=== "Cos innego"
    ```
    cos1
    ```
```
**Efekt:**

=== "Python"
    ```python
    print("Hello world")
    ```

=== "JavaScript"
    ```js
    console.log("Hello world");
    ```

=== "Cos innego"
    ```
    cos1
    ```

[❕️  Więcej na temat code_blocks](https://squidfunk.github.io/mkdocs-material/reference/code-blocks/#highlighting-specific-lines-lines)

---

## 😄 Emoji

Używaj emoji w stylu `:nazwa:` — zostaną automatycznie wyrenderowane jako **ostre SVG** (Twemoji):

```md
:rocket: :sparkles: :tada: :warning: :memo:
```

**Efekt:** 🚀 ✨ 🎉 ⚠️ 📝

[❕️  Więcej na temat emoji](https://squidfunk.github.io/mkdocs-material/reference/icons-emojis/)

---

## 🖋️ Atrybuty elementów (attr_list)

Dzięki `attr_list` możesz dodawać **klasy, identyfikatory i style** bezpośrednio do elementów Markdowna.

```md
[Przycisk](#){.btn .btn--primary}
```

**Efekt:**

[Przycisk](#){.btn .btn--primary}

> 💡 Styl przycisku zależy od Twojego pliku CSS (`extra_css`).

---

## 🧩 Tabele

Standardowy Markdown obsługuje tabele:

```md
| Komenda         | Opis                                |
|-----------------|--------------------------------------|
| `mkdocs serve`  | Uruchamia lokalny serwer podglądu   |
| `mkdocs build`  | Tworzy statyczną wersję strony       |
```

**Efekt:**

| Komenda         | Opis                                |
|-----------------|--------------------------------------|
| `mkdocs serve`  | Uruchamia lokalny serwer podglądu   |
| `mkdocs build`  | Tworzy statyczną wersję strony       |

[❕️  Więcej na temat tabeli](https://squidfunk.github.io/mkdocs-material/reference/data-tables/)

---

## 📚 Dodatkowe źródła

- 📖 [MkDocs Material Documentation](https://squidfunk.github.io/mkdocs-material/)
- 🧩 [Pymdown Extensions](https://facelessuser.github.io/pymdown-extensions/)
- 😄 [Emoji Cheat Sheet](https://github.com/ikatyang/emoji-cheat-sheet)
- 🧰 [MkDocs Configuration Reference](https://www.mkdocs.org/user-guide/configuration/)

---

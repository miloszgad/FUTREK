# FUTrek Store

Sklep FUTrek z:

- koszykiem zapisującym dane w `localStorage`,
- stroną kasy,
- Stripe Embedded Checkout,
- Netlify Functions,
- stroną potwierdzenia płatności,
- webhookiem `checkout.session.completed`.

## Struktura

```text
.
├── index.html
├── kasa.html
├── dziekujemy.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── netlify/
│   └── functions/
├── netlify.toml
├── package.json
└── README.md
```

## Obrazy

Dodaj do `assets/images/`:

- `logo.jpeg`
- `laptop.jpeg`
- `obrona.png`
- `atak.png`
- `mentality.png`

## Wdrożenie przez GitHub i Netlify

1. Utwórz nowe repozytorium GitHub.
2. Wgraj całą zawartość tego folderu.
3. W Netlify wybierz **Add new project → Import an existing project**.
4. Wybierz GitHub i to repozytorium.
5. Netlify odczyta `netlify.toml`.
6. Dodaj w Netlify zmienną środowiskową:
   - `STRIPE_SECRET_KEY`
   - wartość: Twój tajny klucz `sk_live_...`
7. Uruchom deploy.

## Webhook Stripe

Po pierwszym deployu dodaj w Stripe webhook:

```text
https://TWOJA-DOMENA/.netlify/functions/stripe-webhook
```

Wybierz zdarzenie:

```text
checkout.session.completed
```

Stripe pokaże klucz `whsec_...`. Dodaj go w Netlify jako:

```text
STRIPE_WEBHOOK_SECRET
```

Potem wykonaj ponowny deploy.

## Bezpieczeństwo

Nigdy nie wpisuj `sk_live_...` ani `whsec_...` do plików HTML lub JavaScript.


## Obsługa przeglądarki TikToka

- TikTok jest wykrywany po `userAgent`.
- Zamiast uruchamiać płatność pojawia się instrukcja otwarcia strony w Safari/Chrome.
- Link do kasy zawiera zakodowany koszyk w parametrze `cart`.
- Po otwarciu tego linku w zewnętrznej przeglądarce koszyk odtwarza się automatycznie.

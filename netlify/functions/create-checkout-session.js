const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_BY_PRODUCT = Object.freeze({
  "wild-mentality": "price_1TkMkQHduHJ2QTTS4ZYujv7J",
  "area-control": "price_1TkMjFHduHJ2QTTSXXqShAXy",
  "full-game-control": "price_1TkMgmHduHJ2QTTSVJUF4zDM",
  "build-your-team": "price_1TkMdtHduHJ2QTTSmBPptM7q",
  "goal-machine": "price_1TQwhtHduHJ2QTTSJjUAJn0F"
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: JSON.stringify({ error: "Dozwolona jest tylko metoda POST." })
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Brak konfiguracji Stripe na serwerze." })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length || items.length > 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Koszyk jest pusty albo nieprawidłowy." })
      };
    }

    const lineItems = items.map((item) => {
      const price = PRICE_BY_PRODUCT[item.id];
      const quantity = Number(item.quantity);

      if (!price) throw new Error("Nieprawidłowy produkt w koszyku.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new Error("Nieprawidłowa liczba produktów.");
      }

      return { price, quantity };
    });

    const origin = event.headers.origin || "https://futrek.pl";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: lineItems,
      return_url: `${origin}/dziekujemy.html?session_id={CHECKOUT_SESSION_ID}`,
      customer_creation: "always",
      locale: "pl",
      metadata: { source: "futrek_cart" }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({ clientSecret: session.client_secret })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message || "Nie udało się utworzyć płatności."
      })
    };
  }
};

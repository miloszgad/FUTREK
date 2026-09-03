const Stripe = require("stripe");

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Dozwolona jest tylko metoda GET." }, { Allow: "GET" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("Brakuje STRIPE_SECRET_KEY w Netlify.");
    return json(500, { error: "Brak konfiguracji Stripe na serwerze." });
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return json(400, { error: "Nieprawidłowy identyfikator sesji." });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return json(200, {
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || null
    });
  } catch (error) {
    console.error("session-status:", error);
    return json(400, { error: "Nie udało się sprawdzić płatności." });
  }
};

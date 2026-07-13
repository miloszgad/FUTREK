const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { Allow: "GET" },
      body: JSON.stringify({ error: "Dozwolona jest tylko metoda GET." })
    };
  }

  const sessionId = event.queryStringParameters?.session_id;

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Nieprawidłowy identyfikator sesji." })
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || null
      })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Nie udało się sprawdzić płatności." })
    };
  }
};

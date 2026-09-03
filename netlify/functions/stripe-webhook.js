const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers["stripe-signature"];

  if (!stripeSecretKey || !webhookSecret || !signature) {
    console.error("Brakuje konfiguracji Stripe/webhooka.");
    return { statusCode: 400, body: "Brak konfiguracji webhooka." };
  }

  const stripe = new Stripe(stripeSecretKey);
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature error:", error.message);
    return { statusCode: 400, body: "Nieprawidłowy podpis webhooka." };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    if (session.payment_status === "paid") {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      console.log("Opłacone zamówienie FUTrek", {
        sessionId: session.id,
        email: session.customer_details?.email || null,
        amountTotal: session.amount_total,
        currency: session.currency,
        products: lineItems.data.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          amountTotal: item.amount_total
        }))
      });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ received: true })
  };
};

const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const signature = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return { statusCode: 400, body: "Brak konfiguracji webhooka." };
  }

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Webhook signature error:", error.message);
    return { statusCode: 400, body: "Nieprawidłowy podpis webhooka." };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    if (session.payment_status === "paid") {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: 100 }
      );

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
    body: JSON.stringify({ received: true })
  };
};

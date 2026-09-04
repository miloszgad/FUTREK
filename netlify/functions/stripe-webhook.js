const Stripe = require('stripe');
const { getSupabase } = require('./_shared/analysis');
const { ANALYSIS_PRICE_ID } = require('./_shared/products');

async function ensureAnalysisPurchase(session, lineItems) {
  const analysisItem = lineItems.data.find(item => item.price?.id === ANALYSIS_PRICE_ID);
  if (!analysisItem) return;

  const supabase = getSupabase();
  const email = session.customer_details?.email || null;

  const { error } = await supabase
    .from('analysis_purchases')
    .upsert({
      stripe_session_id: session.id,
      customer_email: email,
      status: 'active'
    }, {
      onConflict: 'stripe_session_id',
      ignoreDuplicates: true
    });

  if (error) throw error;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method Not Allowed' };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers['stripe-signature'];

  if (!stripeSecretKey || !webhookSecret || !signature) {
    console.error('Brakuje konfiguracji Stripe/webhooka.');
    return { statusCode: 400, body: 'Brak konfiguracji webhooka.' };
  }

  const stripe = new Stripe(stripeSecretKey);
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature error:', error.message);
    return { statusCode: 400, body: 'Nieprawidłowy podpis webhooka.' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    if (session.payment_status === 'paid') {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        await ensureAnalysisPurchase(session, lineItems);

        console.log('Opłacone zamówienie FUTrek', {
          sessionId: session.id,
          email: session.customer_details?.email || null,
          amountTotal: session.amount_total,
          currency: session.currency,
          products: lineItems.data.map(item => ({
            priceId: item.price?.id || null,
            description: item.description,
            quantity: item.quantity,
            amountTotal: item.amount_total
          }))
        });
      } catch (error) {
        // Stripe pozostaje źródłem prawdy o płatności. Jeśli Supabase jest chwilowo
        // niedostępny, session-status spróbuje odtworzyć dostęp przy wejściu klienta
        // na stronę podziękowania.
        console.error('Nie udało się zsynchronizować zakupu analizy z Supabase:', error);
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ received: true })
  };
};

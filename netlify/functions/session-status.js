const Stripe = require('stripe');
const { getSupabase } = require('./_shared/analysis');
const { makeAccessToken } = require('./_shared/purchase-access');
const { ANALYSIS_PRICE_ID } = require('./_shared/products');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

async function ensureAnalysisPurchase(session, lineItems) {
  const analysisItem = lineItems.data.find(item => item.price?.id === ANALYSIS_PRICE_ID);
  if (!analysisItem) return null;

  const supabase = getSupabase();
  const email = session.customer_details?.email || null;

  let { data: purchase, error } = await supabase
    .from('analysis_purchases')
    .select('*')
    .eq('stripe_session_id', session.id)
    .maybeSingle();

  if (error) throw error;

  if (!purchase) {
    const inserted = await supabase
      .from('analysis_purchases')
      .insert({
        stripe_session_id: session.id,
        customer_email: email,
        status: 'active'
      })
      .select('*')
      .single();

    if (inserted.error) throw inserted.error;
    purchase = inserted.data;
  } else if (!purchase.customer_email && email) {
    const updated = await supabase
      .from('analysis_purchases')
      .update({ customer_email: email })
      .eq('id', purchase.id)
      .select('*')
      .single();
    if (updated.error) throw updated.error;
    purchase = updated.data;
  }

  const token = makeAccessToken(purchase.id, purchase.stripe_session_id);
  return {
    purchaseId: purchase.id,
    accessToken: token,
    status: purchase.status,
    analysisId: purchase.analysis_id
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Dozwolona jest tylko metoda GET.' }, { Allow: 'GET' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('Brakuje STRIPE_SECRET_KEY w Netlify.');
    return json(500, { error: 'Brak konfiguracji Stripe na serwerze.' });
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return json(400, { error: 'Nieprawidłowy identyfikator sesji.' });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    let analysisAccess = null;
    if (session.payment_status === 'paid') {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      analysisAccess = await ensureAnalysisPurchase(session, lineItems);
    }

    return json(200, {
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || null,
      analysisAccess
    });
  } catch (error) {
    console.error('session-status:', error);
    return json(400, { error: 'Nie udało się sprawdzić płatności.' });
  }
};

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

async function ensureAnalysisPurchases(session, lineItems) {
  const analysisItem = lineItems.data.find(item => item.price?.id === ANALYSIS_PRICE_ID);
  const quantity = Math.max(0, Number(analysisItem?.quantity) || 0);
  if (!quantity) return [];

  const supabase = getSupabase();
  const email = session.customer_details?.email || null;

  const { data: existing, error: selectError } = await supabase
    .from('analysis_purchases')
    .select('*')
    .eq('stripe_session_id', session.id)
    .order('unit_index', { ascending: true });

  if (selectError) throw selectError;

  const byIndex = new Map((existing || []).map(row => [Number(row.unit_index) || 1, row]));

  for (let unitIndex = 1; unitIndex <= quantity; unitIndex += 1) {
    if (byIndex.has(unitIndex)) continue;

    const inserted = await supabase
      .from('analysis_purchases')
      .insert({
        stripe_session_id: session.id,
        unit_index: unitIndex,
        customer_email: email,
        status: 'active'
      })
      .select('*')
      .single();

    if (inserted.error) throw inserted.error;
    byIndex.set(unitIndex, inserted.data);
  }

  const purchases = Array.from(byIndex.values())
    .filter(row => (Number(row.unit_index) || 1) <= quantity)
    .sort((a, b) => (Number(a.unit_index) || 1) - (Number(b.unit_index) || 1));

  if (email) {
    for (const purchase of purchases) {
      if (purchase.customer_email) continue;
      const updated = await supabase
        .from('analysis_purchases')
        .update({ customer_email: email })
        .eq('id', purchase.id)
        .select('*')
        .single();
      if (updated.error) throw updated.error;
      Object.assign(purchase, updated.data);
    }
  }

  return purchases.map(purchase => ({
    purchaseId: purchase.id,
    accessToken: makeAccessToken(purchase.id, purchase.stripe_session_id),
    status: purchase.status,
    analysisId: purchase.analysis_id,
    unitIndex: Number(purchase.unit_index) || 1
  }));
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

    let analysisAccesses = [];
    if (session.payment_status === 'paid') {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      analysisAccesses = await ensureAnalysisPurchases(session, lineItems);
    }

    return json(200, {
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || null,
      analysisAccess: analysisAccesses[0] || null,
      analysisAccesses
    });
  } catch (error) {
    console.error('session-status:', error);
    return json(400, { error: 'Nie udało się sprawdzić płatności.' });
  }
};

const crypto = require('crypto');
const { getSupabase } = require('./analysis');

function getAccessSecret() {
  const secret = process.env.ANALYSIS_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Brakuje ANALYSIS_ACCESS_SECRET w Netlify albo sekret jest zbyt krótki.');
  }
  return secret;
}

function makeAccessToken(purchaseId, stripeSessionId) {
  return crypto
    .createHmac('sha256', getAccessSecret())
    .update(`${purchaseId}.${stripeSessionId}`)
    .digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validPurchaseCredentials(purchaseId, accessToken) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(purchaseId || ''))
    && /^[0-9a-f]{64}$/i.test(String(accessToken || ''));
}

async function getAuthorizedPurchase(purchaseId, accessToken) {
  if (!validPurchaseCredentials(purchaseId, accessToken)) {
    return { purchase: null, authorized: false };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('analysis_purchases')
    .select('*')
    .eq('id', purchaseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { purchase: null, authorized: false };

  const expected = makeAccessToken(data.id, data.stripe_session_id);
  return { purchase: data, authorized: safeEqual(expected, accessToken), supabase };
}

async function ensureAnalysisRow(supabase, purchase, accessToken) {
  const analysisId = purchase.analysis_id;
  if (!analysisId) throw new Error('Zakup nie ma przypisanego analysis_id.');

  const { data: existing, error: selectError } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('analyses')
    .insert({
      id: analysisId,
      draft_key_hash: crypto.createHash('sha256').update(String(accessToken)).digest('hex'),
      email: purchase.customer_email || null,
      status: 'draft'
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  makeAccessToken,
  validPurchaseCredentials,
  getAuthorizedPurchase,
  ensureAnalysisRow
};

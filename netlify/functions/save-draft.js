const { json, normalizeDraftFields } = require('./_shared/analysis');
const { getAuthorizedPurchase, ensureAnalysisRow } = require('./_shared/purchase-access');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Dozwolona jest tylko metoda POST.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Nieprawidłowe dane formularza.' }); }

  const { purchaseId, accessToken } = body;

  try {
    const { purchase, authorized, supabase } = await getAuthorizedPurchase(purchaseId, accessToken);
    if (!authorized || !purchase) return json(403, { error: 'Ta ankieta wymaga opłaconej analizy.' });
    if (purchase.status === 'submitted') return json(409, { error: 'Ta ankieta została już wysłana.', status: 'submitted' });
    if (purchase.status !== 'active') return json(403, { error: 'Ten dostęp do ankiety nie jest aktywny.' });

    await ensureAnalysisRow(supabase, purchase, accessToken);

    const fields = normalizeDraftFields(body);
    const result = await supabase
      .from('analyses')
      .update(fields)
      .eq('id', purchase.analysis_id)
      .eq('status', 'draft')
      .select('id, status')
      .single();

    if (result.error) {
      console.error('Supabase draft error:', result.error);
      return json(500, { error: 'Nie udało się zapisać postępu.' });
    }

    return json(200, { success: true, id: result.data.id, status: result.data.status });
  } catch (error) {
    console.error('save-draft error:', error);
    return json(500, { error: 'Nie udało się zapisać postępu.' });
  }
};

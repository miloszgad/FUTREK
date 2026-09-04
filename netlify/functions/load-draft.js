const { json } = require('./_shared/analysis');
const { getAuthorizedPurchase, ensureAnalysisRow } = require('./_shared/purchase-access');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Dozwolona jest tylko metoda POST.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Nieprawidłowe dane.' }); }

  const { purchaseId, accessToken } = body;

  try {
    const { purchase, authorized, supabase } = await getAuthorizedPurchase(purchaseId, accessToken);
    if (!authorized || !purchase) return json(403, { error: 'Ta ankieta wymaga opłaconej analizy.' });

    const row = await ensureAnalysisRow(supabase, purchase, accessToken);

    let signedImageUrl = null;
    if (row.squad_image_url) {
      const { data } = await supabase.storage
        .from('squad-images')
        .createSignedUrl(row.squad_image_url, 600);
      signedImageUrl = data?.signedUrl || null;
    }

    return json(200, {
      success: true,
      found: true,
      status: row.status,
      purchaseStatus: purchase.status,
      draft: {
        email: row.email || purchase.customer_email || '',
        name: row.name || '',
        division: row.division || '',
        budget: row.budget ?? '',
        playStyle: row.play_style || [],
        favoritePlaystyles: row.playstyles || [],
        otherPlaystyle: row.other_playstyle || '',
        rebuildGoals: row.rebuild_priorities || [],
        tradablePlayers: row.tradeable_players || '',
        mustKeepPlayers: row.must_keep_players || '',
        feedback: row.feedback || '',
        squadImagePath: row.squad_image_url || null,
        signedImageUrl
      }
    });
  } catch (error) {
    console.error('load-draft error:', error);
    return json(500, { error: 'Nie udało się pobrać zapisanej ankiety.' });
  }
};

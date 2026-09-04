const { json, parseImageDataUrl } = require('./_shared/analysis');
const { getAuthorizedPurchase, ensureAnalysisRow } = require('./_shared/purchase-access');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Dozwolona jest tylko metoda POST.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Nieprawidłowe dane.' }); }

  const { purchaseId, accessToken, squadImage } = body;
  const parsedImage = parseImageDataUrl(squadImage?.dataUrl);
  if (!parsedImage) return json(400, { error: 'Nie udało się odczytać zdjęcia składu.' });
  if (parsedImage.buffer.length > 6 * 1024 * 1024) return json(400, { error: 'Zdjęcie składu jest za duże.' });

  try {
    const { purchase, authorized, supabase } = await getAuthorizedPurchase(purchaseId, accessToken);
    if (!authorized || !purchase) return json(403, { error: 'Ta ankieta wymaga opłaconej analizy.' });
    if (purchase.status === 'submitted') return json(409, { error: 'Ta ankieta została już wysłana.' });
    if (purchase.status !== 'active') return json(403, { error: 'Ten dostęp do ankiety nie jest aktywny.' });

    const row = await ensureAnalysisRow(supabase, purchase, accessToken);

    const imagePath = `${purchase.analysis_id}/draft-squad.${parsedImage.extension}`;
    const { error: uploadError } = await supabase.storage
      .from('squad-images')
      .upload(imagePath, parsedImage.buffer, {
        contentType: parsedImage.contentType,
        cacheControl: '3600',
        upsert: true
      });
    if (uploadError) throw uploadError;

    const previousPath = row?.squad_image_url || null;
    const { error: updateError } = await supabase
      .from('analyses')
      .update({ squad_image_url: imagePath })
      .eq('id', purchase.analysis_id)
      .eq('status', 'draft');
    if (updateError) throw updateError;

    if (previousPath && previousPath !== imagePath) {
      await supabase.storage.from('squad-images').remove([previousPath]);
    }

    const { data: signed } = await supabase.storage
      .from('squad-images')
      .createSignedUrl(imagePath, 600);

    return json(200, { success: true, imagePath, signedImageUrl: signed?.signedUrl || null });
  } catch (error) {
    console.error('save-draft-image error:', error);
    return json(500, { error: 'Nie udało się zapisać zdjęcia składu.' });
  }
};

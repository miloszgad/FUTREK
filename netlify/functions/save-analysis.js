const { json, parseImageDataUrl, normalizeDraftFields } = require('./_shared/analysis');
const { getAuthorizedPurchase, ensureAnalysisRow } = require('./_shared/purchase-access');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Dozwolona jest tylko metoda POST.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Nieprawidłowe dane formularza.' }); }

  const {
    purchaseId,
    accessToken,
    email,
    name,
    division,
    budget,
    playStyle,
    favoritePlaystyles,
    otherPlaystyle,
    rebuildGoals,
    tradablePlayers,
    mustKeepPlayers,
    feedback,
    squadImage
  } = body;

  const parsedBudget = Number(budget);
  const hasRequiredData =
    typeof email === 'string' && email.trim() &&
    typeof name === 'string' && name.trim() &&
    typeof division === 'string' && division.trim() &&
    Number.isFinite(parsedBudget) && parsedBudget >= 0 &&
    Array.isArray(playStyle) && playStyle.length > 0 &&
    ((Array.isArray(favoritePlaystyles) && favoritePlaystyles.length > 0) ||
      (typeof otherPlaystyle === 'string' && otherPlaystyle.trim())) &&
    Array.isArray(rebuildGoals) && rebuildGoals.length > 0 &&
    typeof tradablePlayers === 'string' && tradablePlayers.trim();

  if (!hasRequiredData) return json(400, { error: 'Brakuje wymaganych danych ankiety.' });

  try {
    const { purchase, authorized, supabase } = await getAuthorizedPurchase(purchaseId, accessToken);
    if (!authorized || !purchase) return json(403, { error: 'Ta ankieta wymaga opłaconej analizy.' });
    if (purchase.status === 'submitted') return json(409, { error: 'Ta ankieta została już wysłana.' });
    if (purchase.status !== 'active') return json(403, { error: 'Ten dostęp do ankiety nie jest aktywny.' });

    const row = await ensureAnalysisRow(supabase, purchase, accessToken);
    if (row?.status === 'submitted') return json(409, { error: 'Ta ankieta została już wysłana.' });

    let imagePath = row?.squad_image_url || null;
    let newImagePath = null;

    if (squadImage?.dataUrl) {
      const parsedImage = parseImageDataUrl(squadImage.dataUrl);
      if (!parsedImage) return json(400, { error: 'Nie udało się odczytać zdjęcia składu.' });
      if (parsedImage.buffer.length > 6 * 1024 * 1024) return json(400, { error: 'Zdjęcie składu jest za duże.' });

      newImagePath = `${purchase.analysis_id}/squad-final-${Date.now()}.${parsedImage.extension}`;
      const { error: uploadError } = await supabase.storage
        .from('squad-images')
        .upload(newImagePath, parsedImage.buffer, {
          contentType: parsedImage.contentType,
          cacheControl: '3600',
          upsert: false
        });
      if (uploadError) {
        console.error('Supabase Storage error:', uploadError);
        return json(500, { error: 'Nie udało się wysłać zdjęcia składu.' });
      }
      imagePath = newImagePath;
    }

    if (!imagePath) return json(400, { error: 'Dodaj zdjęcie składu przed wysłaniem.' });

    const fields = {
      ...normalizeDraftFields({
        email,
        name,
        division,
        budget,
        playStyle,
        favoritePlaystyles,
        otherPlaystyle,
        rebuildGoals,
        tradablePlayers,
        mustKeepPlayers,
        feedback
      }),
      squad_image_url: imagePath,
      status: 'submitted'
    };

    const result = await supabase
      .from('analyses')
      .update(fields)
      .eq('id', purchase.analysis_id)
      .eq('status', 'draft')
      .select('id, squad_image_url, status')
      .single();

    if (result.error) {
      console.error('Supabase database error:', result.error);
      if (newImagePath) await supabase.storage.from('squad-images').remove([newImagePath]);
      return json(500, { error: 'Nie udało się zapisać analizy w bazie.' });
    }

    const purchaseUpdate = await supabase
      .from('analysis_purchases')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', purchase.id)
      .eq('status', 'active');

    if (purchaseUpdate.error) {
      console.error('Nie udało się zamknąć dostępu do zakupu:', purchaseUpdate.error);
      return json(500, { error: 'Analiza została zapisana, ale nie udało się zamknąć dostępu. Skontaktuj się z FUTrek.' });
    }

    if (newImagePath && row?.squad_image_url && row.squad_image_url !== newImagePath) {
      await supabase.storage.from('squad-images').remove([row.squad_image_url]);
    }

    return json(200, {
      success: true,
      status: result.data.status
    });
  } catch (error) {
    console.error('save-analysis error:', error);
    return json(500, { error: 'Nie udało się zapisać analizy.' });
  }
};

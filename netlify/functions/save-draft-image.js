const {
  json,
  getSupabase,
  hashSecret,
  validDraftCredentials,
  parseImageDataUrl,
  getAuthorizedDraft
} = require("./_shared/analysis");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Dozwolona jest tylko metoda POST." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Nieprawidłowe dane." }); }

  const { draftId, draftSecret, squadImage } = body;
  if (!validDraftCredentials(draftId, draftSecret)) return json(400, { error: "Nieprawidłowy identyfikator wersji roboczej." });

  const parsedImage = parseImageDataUrl(squadImage?.dataUrl);
  if (!parsedImage) return json(400, { error: "Nie udało się odczytać zdjęcia składu." });
  if (parsedImage.buffer.length > 6 * 1024 * 1024) return json(400, { error: "Zdjęcie składu jest za duże." });

  try {
    const supabase = getSupabase();
    const { row, authorized } = await getAuthorizedDraft(supabase, draftId, draftSecret);
    if (!authorized) return json(403, { error: "Brak dostępu do tej wersji roboczej." });
    if (row?.status === "submitted") return json(409, { error: "Ta ankieta została już wysłana." });

    if (!row) {
      const { error: createError } = await supabase.from("analyses").insert({
        id: draftId,
        draft_key_hash: hashSecret(draftSecret),
        status: "draft"
      });
      if (createError) throw createError;
    }

    const imagePath = `${draftId}/draft-squad.${parsedImage.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("squad-images")
      .upload(imagePath, parsedImage.buffer, {
        contentType: parsedImage.contentType,
        cacheControl: "3600",
        upsert: true
      });
    if (uploadError) throw uploadError;

    const previousPath = row?.squad_image_url || null;
    const { error: updateError } = await supabase
      .from("analyses")
      .update({ squad_image_url: imagePath })
      .eq("id", draftId)
      .eq("status", "draft");
    if (updateError) throw updateError;

    if (previousPath && previousPath !== imagePath) {
      await supabase.storage.from("squad-images").remove([previousPath]);
    }

    const { data: signed } = await supabase.storage
      .from("squad-images")
      .createSignedUrl(imagePath, 600);

    return json(200, { success: true, imagePath, signedImageUrl: signed?.signedUrl || null });
  } catch (error) {
    console.error("save-draft-image error:", error);
    return json(500, { error: "Nie udało się zapisać zdjęcia składu." });
  }
};

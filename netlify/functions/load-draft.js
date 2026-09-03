const { json, getSupabase, validDraftCredentials, getAuthorizedDraft } = require("./_shared/analysis");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Dozwolona jest tylko metoda POST." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Nieprawidłowe dane." }); }

  const { draftId, draftSecret } = body;
  if (!validDraftCredentials(draftId, draftSecret)) return json(400, { error: "Nieprawidłowy identyfikator wersji roboczej." });

  try {
    const supabase = getSupabase();
    const { row, authorized } = await getAuthorizedDraft(supabase, draftId, draftSecret);
    if (!authorized) return json(403, { error: "Brak dostępu do tej wersji roboczej." });
    if (!row) return json(200, { success: true, found: false });

    let signedImageUrl = null;
    if (row.squad_image_url) {
      const { data } = await supabase.storage
        .from("squad-images")
        .createSignedUrl(row.squad_image_url, 600);
      signedImageUrl = data?.signedUrl || null;
    }

    return json(200, {
      success: true,
      found: true,
      status: row.status,
      draft: {
        email: row.email || "",
        name: row.name || "",
        division: row.division || "",
        budget: row.budget ?? "",
        playStyle: row.play_style || [],
        favoritePlaystyles: row.playstyles || [],
        otherPlaystyle: row.other_playstyle || "",
        rebuildGoals: row.rebuild_priorities || [],
        tradablePlayers: row.tradeable_players || "",
        mustKeepPlayers: row.must_keep_players || "",
        feedback: row.feedback || "",
        squadImagePath: row.squad_image_url || null,
        signedImageUrl
      }
    });
  } catch (error) {
    console.error("load-draft error:", error);
    return json(500, { error: "Nie udało się pobrać zapisanej ankiety." });
  }
};

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return {
    contentType,
    extension: extensions[contentType],
    buffer
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Dozwolona jest tylko metoda POST." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Brakuje SUPABASE_URL lub SUPABASE_SECRET_KEY w Netlify.");
    return json(500, { error: "Błąd konfiguracji serwera." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Nieprawidłowe dane formularza." });
  }

  const {
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
    typeof email === "string" && email.trim() &&
    typeof name === "string" && name.trim() &&
    typeof division === "string" && division.trim() &&
    Number.isFinite(parsedBudget) && parsedBudget >= 0 &&
    Array.isArray(playStyle) && playStyle.length > 0 &&
    ((Array.isArray(favoritePlaystyles) && favoritePlaystyles.length > 0) ||
      (typeof otherPlaystyle === "string" && otherPlaystyle.trim())) &&
    Array.isArray(rebuildGoals) && rebuildGoals.length > 0 &&
    typeof tradablePlayers === "string" && tradablePlayers.trim();

  if (!hasRequiredData) {
    return json(400, { error: "Brakuje wymaganych danych ankiety." });
  }

  const parsedImage = parseImageDataUrl(squadImage?.dataUrl);
  if (!parsedImage) {
    return json(400, { error: "Nie udało się odczytać zdjęcia składu." });
  }

  const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
  if (parsedImage.buffer.length > MAX_IMAGE_BYTES) {
    return json(400, { error: "Zdjęcie składu jest za duże po przygotowaniu do wysyłki." });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const analysisId = crypto.randomUUID();
  const imagePath = `${analysisId}/squad-${Date.now()}.${parsedImage.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("squad-images")
    .upload(imagePath, parsedImage.buffer, {
      contentType: parsedImage.contentType,
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    console.error("Supabase Storage error:", uploadError);
    return json(500, { error: "Nie udało się wysłać zdjęcia składu." });
  }

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      id: analysisId,
      email: email.trim(),
      name: name.trim(),
      division: division.trim(),
      budget: parsedBudget,
      play_style: playStyle,
      playstyles: Array.isArray(favoritePlaystyles) ? favoritePlaystyles : [],
      other_playstyle: otherPlaystyle?.trim() || null,
      squad_image_url: imagePath,
      rebuild_priorities: rebuildGoals,
      tradeable_players: tradablePlayers.trim(),
      must_keep_players: mustKeepPlayers?.trim() || null,
      feedback: feedback?.trim() || null,
      status: "submitted"
    })
    .select("id, squad_image_url")
    .single();

  if (error) {
    console.error("Supabase database error:", error);

    const { error: cleanupError } = await supabase.storage
      .from("squad-images")
      .remove([imagePath]);

    if (cleanupError) {
      console.error("Nie udało się posprzątać osieroconego zdjęcia:", cleanupError);
    }

    return json(500, { error: "Nie udało się zapisać analizy w bazie." });
  }

  return json(200, {
    success: true,
    analysisId: data.id,
    squadImagePath: data.squad_image_url
  });
};

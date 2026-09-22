(() => {
  "use strict";

  const FORM_ID = "analysis-form";
  const DRAFT_KEY = "futrek_analysis_draft_v1";
  const PURCHASE_ACCESS_KEY = "futrek_analysis_purchase_access_v1";
  const REQUIRED_QUESTIONS = [
    "email",
    "name",
    "division",
    "budget",
    "playStyle",
    "favoritePlaystyles",
    "squadImage",
    "rebuildGoals",
    "tradablePlayers"
  ];
  const MAX_REBUILD_GOALS = 3;
  const IS_LOCAL_PREVIEW = window.location.protocol === "file:";

  const form = document.getElementById(FORM_ID);
  if (!form) return;

  const progressPercent = document.getElementById("progress-percent");
  const progressLeft = document.getElementById("progress-left");
  const progressBar = document.getElementById("progress-bar");
  const goalCount = document.getElementById("goal-count");
  const squadImageInput = document.getElementById("squad-image");
  const fileLabel = document.getElementById("file-label");
  const filePreview = document.getElementById("file-preview");
  const filePreviewImage = document.getElementById("file-preview-image");
  const submitStatus = document.getElementById("submit-status");
  const saveNote = document.getElementById("save-note");

  let hasSquadImage = false;
  let draftTimer = null;
  let remoteSaveInFlight = false;
  let remoteSaveQueued = false;
  let currentImagePath = null;
  let formRevision = 0;
  let imageUploadPromise = null;
  let imageSelectionRevision = 0;
  let imageUploadError = null;
  let remoteSavePromise = null;
  let submitting = false;

  function getPurchaseAccess() {
    if (IS_LOCAL_PREVIEW) return { purchaseId: "local-preview", accessToken: "local-preview" };

    const params = new URLSearchParams(window.location.search);
    const purchaseId = params.get("purchase_id");
    const accessToken = params.get("access_token");

    if (purchaseId && accessToken) {
      const access = { purchaseId, accessToken };
      localStorage.setItem(PURCHASE_ACCESS_KEY, JSON.stringify(access));

      // Usuwamy token z paska adresu po zapisaniu go lokalnie.
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("purchase_id");
      cleanUrl.searchParams.delete("access_token");
      window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      return access;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(PURCHASE_ACCESS_KEY) || "null");
      if (stored?.purchaseId && stored?.accessToken) return stored;
    } catch {}

    return null;
  }

  const access = getPurchaseAccess();
  const activeDraftKey = access && !IS_LOCAL_PREVIEW ? `${DRAFT_KEY}_${access.purchaseId}` : DRAFT_KEY;

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  function hasText(id) {
    const element = document.getElementById(id);
    return Boolean(element && element.value.trim());
  }

  function isQuestionComplete(question) {
    switch (question) {
      case "email": {
        const email = document.getElementById("email");
        return Boolean(email.value.trim() && email.validity.valid);
      }
      case "name": return hasText("name");
      case "division": return hasText("division");
      case "budget": {
        const input = document.getElementById("budget");
        const value = Number(input.value);
        return Number.isFinite(value) && value >= 0 && input.value !== "";
      }
      case "playStyle": return checkedValues("playStyle").length > 0;
      case "favoritePlaystyles": return checkedValues("favoritePlaystyles").length > 0 || hasText("other-playstyle");
      case "squadImage": return hasSquadImage;
      case "rebuildGoals": return checkedValues("rebuildGoals").length > 0;
      case "tradablePlayers": return hasText("tradable-players");
      default: return false;
    }
  }

  function updateProgress() {
    const completed = REQUIRED_QUESTIONS.filter(isQuestionComplete).length;
    const total = REQUIRED_QUESTIONS.length;
    const percent = Math.round((completed / total) * 100);
    const left = total - completed;

    progressPercent.textContent = `${percent}%`;
    progressLeft.textContent = left === 0
      ? "Wszystkie wymagane odpowiedzi gotowe"
      : `Pozostało ${left} ${left === 1 ? "odpowiedź" : "odpowiedzi"}`;
    progressBar.style.width = `${percent}%`;

    REQUIRED_QUESTIONS.forEach(question => {
      const card = form.querySelector(`[data-question="${question}"]`);
      if (card) card.classList.toggle("is-complete", isQuestionComplete(question));
    });
  }

  function setError(question, message = "") {
    const card = form.querySelector(`[data-question="${question}"]`);
    const error = form.querySelector(`[data-error-for="${question}"]`);
    if (card) card.classList.toggle("has-error", Boolean(message));
    if (error) error.textContent = message;
  }

  function clearErrors() {
    REQUIRED_QUESTIONS.forEach(question => setError(question));
  }

  function validateForm() {
    clearErrors();
    const messages = {
      email: "Podaj poprawny adres e-mail.",
      name: "Podaj swoje imię.",
      division: "Wybierz aktualną dywizję.",
      budget: "Podaj budżet w coinsach.",
      playStyle: "Wybierz przynajmniej jeden styl gry.",
      favoritePlaystyles: "Wybierz przynajmniej jeden PlayStyle lub wpisz własny.",
      squadImage: "Dodaj zdjęcie aktualnego składu.",
      rebuildGoals: "Wybierz przynajmniej jeden priorytet przebudowy.",
      tradablePlayers: "Wpisz zawodników wymiennych. Jeśli nie masz żadnych, wpisz „brak”."
    };

    const invalid = REQUIRED_QUESTIONS.filter(question => !isQuestionComplete(question));
    invalid.forEach(question => setError(question, messages[question]));

    if (invalid.length > 0) {
      form.querySelector(`[data-question="${invalid[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function getDraftData() {
    return {
      email: document.getElementById("email").value,
      name: document.getElementById("name").value,
      division: document.getElementById("division").value,
      budget: document.getElementById("budget").value,
      playStyle: checkedValues("playStyle"),
      favoritePlaystyles: checkedValues("favoritePlaystyles"),
      otherPlaystyle: document.getElementById("other-playstyle").value,
      rebuildGoals: checkedValues("rebuildGoals"),
      tradablePlayers: document.getElementById("tradable-players").value,
      mustKeepPlayers: document.getElementById("must-keep-players").value,
      feedback: document.getElementById("feedback").value,
      savedAt: new Date().toISOString()
    };
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(activeDraftKey, JSON.stringify(getDraftData()));
    } catch (error) {
      console.warn("Nie udało się zapisać wersji roboczej lokalnie.", error);
    }
  }

  function setSaveNote(text) {
    if (saveNote) saveNote.textContent = text;
  }

  async function saveRemoteDraft() {
    if (IS_LOCAL_PREVIEW) return;
    if (!access) {
      setSaveNote("Brak aktywnego dostępu do ankiety.");
      return;
    }
    if (remoteSaveInFlight) {
      remoteSaveQueued = true;
      return;
    }

    remoteSaveInFlight = true;
    const savedRevision = formRevision;
    remoteSaveQueued = false;
    setSaveNote("Zapisywanie postępu…");

    try {
      const payload = getDraftData();
      delete payload.savedAt;

      const response = await fetch("/.netlify/functions/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: access.purchaseId,
          accessToken: access.accessToken,
          ...payload
        })
      });

      const result = await response.json().catch(() => ({}));
      if (response.status === 409 && result.status === "submitted") {
        lockSubmittedForm();
        return;
      }
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać postępu.");

      const time = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      if (savedRevision === formRevision && !submitting) setSaveNote(`Postęp zapisany w chmurze • ${time}`);
    } catch (error) {
      console.warn("Autosave Supabase nie powiódł się:", error);
      setSaveNote("Brak połączenia z chmurą — postęp jest zapisany lokalnie w tej przeglądarce.");
    } finally {
      remoteSaveInFlight = false;
      if (remoteSaveQueued && !submitting) remoteSavePromise = saveRemoteDraft();
    }
  }

  function scheduleDraftSave() {
    saveLocalDraft();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { remoteSavePromise = saveRemoteDraft(); }, 700);
  }

  function restoreCheckboxes(name, values = []) {
    form.querySelectorAll(`input[name="${name}"]`).forEach(input => {
      input.checked = values.includes(input.value);
    });
  }

  function applyDraft(draft) {
    if (!draft) return;
    ["email", "name", "division", "budget"].forEach(id => {
      const element = document.getElementById(id);
      if (element && draft[id] != null) element.value = draft[id];
    });

    document.getElementById("other-playstyle").value = draft.otherPlaystyle || "";
    document.getElementById("tradable-players").value = draft.tradablePlayers || "";
    document.getElementById("must-keep-players").value = draft.mustKeepPlayers || "";
    document.getElementById("feedback").value = draft.feedback || "";

    restoreCheckboxes("playStyle", draft.playStyle);
    restoreCheckboxes("favoritePlaystyles", draft.favoritePlaystyles);
    restoreCheckboxes("rebuildGoals", draft.rebuildGoals);
  }

  function restoreLocalDraft() {
    try {
      const raw = localStorage.getItem(activeDraftKey);
      if (raw) applyDraft(JSON.parse(raw));
    } catch (error) {
      console.warn("Nie udało się odtworzyć lokalnej wersji roboczej.", error);
    }
  }

  async function restoreRemoteDraft() {
    if (IS_LOCAL_PREVIEW) {
      setSaveNote("Podgląd lokalny: postęp zapisuje się w tej przeglądarce.");
      return;
    }

    if (!access) {
      lockNoAccessForm();
      return;
    }

    const initialRevision = formRevision;
    setSaveNote("Sprawdzamy zapisany postęp…");
    try {
      const response = await fetch("/.netlify/functions/load-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: access.purchaseId, accessToken: access.accessToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Nie udało się pobrać postępu.");
      if (!result.found) {
        setSaveNote("Postęp będzie zapisywany automatycznie w chmurze.");
        return;
      }
      if (result.status === "submitted" || result.purchaseStatus === "submitted") {
        lockSubmittedForm();
        return;
      }

      // Never overwrite answers already entered while the remote draft was loading.
      if (formRevision === initialRevision && !localStorage.getItem(activeDraftKey)) applyDraft(result.draft);
      if (!squadImageInput.files.length && result.draft?.squadImagePath) {
        currentImagePath = result.draft.squadImagePath;
        hasSquadImage = true;
        fileLabel.textContent = "Zdjęcie składu jest już zapisane";
        if (result.draft.signedImageUrl) {
          filePreviewImage.src = result.draft.signedImageUrl;
          filePreview.hidden = false;
        }
      }
      if (formRevision === initialRevision) saveLocalDraft();
      updateGoalLimit();
      updateProgress();
      setSaveNote("Przywrócono zapisany postęp z chmury.");
    } catch (error) {
      console.warn("Nie udało się pobrać draftu z Supabase:", error);
      setSaveNote("Nie udało się pobrać chmury — używamy zapisu lokalnego.");
    }
  }

  function updateGoalLimit(changedInput) {
    const selected = form.querySelectorAll('input[name="rebuildGoals"]:checked');
    const all = form.querySelectorAll('input[name="rebuildGoals"]');

    if (selected.length > MAX_REBUILD_GOALS && changedInput) changedInput.checked = false;

    const finalSelected = form.querySelectorAll('input[name="rebuildGoals"]:checked');
    goalCount.textContent = String(finalSelected.length);
    const atLimit = finalSelected.length >= MAX_REBUILD_GOALS;
    all.forEach(input => { input.disabled = atLimit && !input.checked; });
  }

  async function prepareSquadImage(file) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!file || !allowedTypes.includes(file.type)) throw new Error("Zdjęcie składu musi być plikiem JPG, PNG lub WEBP.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Zdjęcie składu jest za duże. Maksymalny rozmiar pliku to 8 MB.");

    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Nie udało się odczytać zdjęcia składu."));
        img.src = sourceUrl;
      });

      const MAX_EDGE = 1800;
      const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Nie udało się przygotować zdjęcia do wysłania.");
      context.drawImage(image, 0, 0, width, height);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      return {
        dataUrl: canvas.toDataURL(outputType, outputType === "image/jpeg" ? 0.84 : undefined),
        type: outputType,
        originalName: file.name
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function saveDraftImage(file, selectionRevision) {
    if (IS_LOCAL_PREVIEW || !file) return;
    if (!access) throw new Error("Brak aktywnego dostępu do ankiety.");
    setSaveNote("Przesyłanie zdjęcia składu… Nie zamykaj tej karty.");
    try {
      const preparedImage = await prepareSquadImage(file);
      const response = await fetch("/.netlify/functions/save-draft-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: access.purchaseId,
          accessToken: access.accessToken,
          squadImage: preparedImage
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.imagePath) {
        throw new Error(result.error || "Nie udało się zapisać zdjęcia.");
      }
      // Później wybrane zdjęcie ma pierwszeństwo przed wcześniejszym żądaniem.
      if (selectionRevision === imageSelectionRevision) {
        currentImagePath = result.imagePath;
        hasSquadImage = true;
        imageUploadError = null;
        setError("squadImage");
        setSaveNote("Zdjęcie składu zapisane w chmurze. Możesz bezpiecznie wrócić do ankiety później.");
        updateProgress();
      }
    } catch (error) {
      if (selectionRevision === imageSelectionRevision) {
        imageUploadError = error;
        setError("squadImage", "Nie zapisano zdjęcia w chmurze. Sprawdź połączenie i ponów wysyłanie formularza.");
        setSaveNote("Nie udało się zapisać zdjęcia. Nie zamykaj karty; spróbuj wysłać ankietę ponownie.");
      }
      throw error;
    }
  }

  function handleImageSelection() {
    if (submitting) return;
    const [file] = squadImageInput.files;
    if (!file) {
      hasSquadImage = Boolean(currentImagePath);
      fileLabel.textContent = currentImagePath ? "Zdjęcie składu jest już zapisane" : "Dodaj zdjęcie składu";
      if (!currentImagePath) {
        filePreview.hidden = true;
        filePreviewImage.removeAttribute("src");
      }
      updateProgress();
      return;
    }

    const revision = ++imageSelectionRevision;
    currentImagePath = null;
    imageUploadError = null;
    hasSquadImage = true;
    setError("squadImage");
    fileLabel.textContent = file.name;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (revision !== imageSelectionRevision) return;
      filePreviewImage.src = reader.result;
      filePreview.hidden = false;
    });
    reader.readAsDataURL(file);
    updateProgress();

    // Kolejkuj wysyłanie: starsze zdjęcie nie może nadpisać później wybranego.
    const previousUpload = imageUploadPromise;
    imageUploadPromise = (async () => {
      if (previousUpload) await previousUpload.catch(() => {});
      if (revision !== imageSelectionRevision) return;
      await saveDraftImage(file, revision);
    })();
    imageUploadPromise.catch(() => {}); // Obsługa błędu następuje w interfejsie i przy finalizacji.
  }

  function handleBrokenPlaystyleImages() {
    form.querySelectorAll(".playstyle-image img").forEach(image => {
      image.addEventListener("error", () => image.classList.add("broken"));
      if (image.complete && image.naturalWidth === 0) image.classList.add("broken");
    });
  }

  function lockNoAccessForm() {
    form.querySelectorAll("input, select, textarea, button").forEach(element => { element.disabled = true; });
    submitStatus.textContent = "Ta ankieta jest dostępna dopiero po opłaceniu analizy ANALIZA SKŁADU.";
    setSaveNote("Brak aktywnego dostępu. Wróć do Futrek.pl i kup analizę.");
  }

  function lockSubmittedForm() {
    form.querySelectorAll("input, select, textarea, button").forEach(element => { element.disabled = true; });
    submitStatus.textContent = "Ta ankieta została już wysłana i nie można jej ponownie edytować.";
    setSaveNote("Ankieta wysłana — edycja została zablokowana.");
  }

  form.addEventListener("input", event => {
    if (event.target.name === "rebuildGoals") updateGoalLimit(event.target);
    formRevision += 1;
    updateProgress();
    scheduleDraftSave();
  });

  form.addEventListener("change", event => {
    if (event.target === squadImageInput) handleImageSelection();
    else formRevision += 1;
    if (event.target.name === "rebuildGoals") updateGoalLimit(event.target);
    updateProgress();
    if (event.target !== squadImageInput) scheduleDraftSave();
  });

  async function submitAnalysis() {
    const submitButton = form.querySelector(".submit-button");
    const payload = getDraftData();
    delete payload.savedAt;
    const [squadFile] = squadImageInput.files;

    if (IS_LOCAL_PREVIEW) {
      saveLocalDraft();
      submitStatus.textContent = "Podgląd lokalny: ankieta jest poprawnie wypełniona. Dane nie zostały wysłane do Supabase.";
      return;
    }

    if (!access) {
      lockNoAccessForm();
      return;
    }

    submitButton.disabled = true;
    submitting = true;
    clearTimeout(draftTimer);
    submitStatus.textContent = "Finalizujemy ankietę…";

    try {
      // Finish previous autosave / image upload before sending final response.
      if (remoteSavePromise) await remoteSavePromise;
      if (imageUploadPromise) await imageUploadPromise.catch(() => {});
      if (squadFile && !currentImagePath) {
        // Powtórz wysyłanie oddzielnym żądaniem; nie umieszczaj zdjęcia w
        // końcowym formularzu, aby nie przekraczać limitu rozmiaru żądania.
        await saveDraftImage(squadFile, imageSelectionRevision);
      }
      if (!currentImagePath) throw new Error("Zdjęcie składu nie zostało zapisane. Wybierz zdjęcie i spróbuj ponownie.");

      const response = await fetch("/.netlify/functions/save-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: access.purchaseId,
          accessToken: access.accessToken,
          ...payload
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Nie udało się zapisać analizy.");

      localStorage.removeItem(activeDraftKey);
      submitStatus.textContent = "Gotowe! Otrzymaliśmy Twoje odpowiedzi. Ankieta została finalnie wysłana.";
      setSaveNote("Ankieta wysłana — edycja została zablokowana.");
      form.querySelectorAll("input, select, textarea, button").forEach(element => { element.disabled = true; });
    } catch (error) {
      console.error("Błąd wysyłania analizy:", error);
      submitStatus.textContent = error.message || "Nie udało się wysłać odpowiedzi. Spróbuj ponownie.";
      submitButton.disabled = false;
      submitting = false;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submitStatus.textContent = "";
    if (!validateForm()) {
      submitStatus.textContent = "Uzupełnij zaznaczone pola przed wysłaniem.";
      return;
    }
    saveLocalDraft();
    await submitAnalysis();
  });

  if (IS_LOCAL_PREVIEW || access) {
    restoreLocalDraft();
  } else {
    localStorage.removeItem(activeDraftKey);
  }
  updateGoalLimit();
  handleBrokenPlaystyleImages();
  updateProgress();
  restoreRemoteDraft();
})();

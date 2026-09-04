const IS_LOCAL_PREVIEW = window.location.protocol === 'file:';
const ANALYSIS_ACCESS_KEY = 'futrek_analysis_purchase_access_v1';
const sessionId = new URLSearchParams(window.location.search).get('session_id');

async function checkSession() {
  const message = document.getElementById('message');
  const status = document.getElementById('status');
  const analysisLink = document.getElementById('analysis-access-link');

  if (IS_LOCAL_PREVIEW) {
    message.textContent = 'Podgląd lokalny strony po zakupie.';
    status.textContent = 'Na Netlify w tym miejscu pojawi się prawdziwy status płatności klienta.';
    return;
  }

  if (!sessionId) {
    message.textContent = 'Nie znaleziono identyfikatora płatności.';
    status.textContent = 'W razie problemów skontaktuj się z FUTrek.';
    return;
  }

  try {
    const response = await fetch(
      '/.netlify/functions/session-status?session_id=' + encodeURIComponent(sessionId)
    );
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Nie udało się sprawdzić płatności.');

    if (data.paymentStatus === 'paid') {
      localStorage.removeItem('futrek_cart');
      message.textContent = 'Płatność została przyjęta.';

      if (data.analysisAccess) {
        const access = {
          purchaseId: data.analysisAccess.purchaseId,
          accessToken: data.analysisAccess.accessToken
        };
        localStorage.setItem(ANALYSIS_ACCESS_KEY, JSON.stringify(access));

        const target = new URL('ankieta.html', window.location.href);
        target.searchParams.set('purchase_id', access.purchaseId);
        target.searchParams.set('access_token', access.accessToken);
        analysisLink.href = target.toString();
        analysisLink.hidden = false;

        status.textContent = data.analysisAccess.status === 'submitted'
          ? 'Ta analiza została już wcześniej wysłana. Możesz otworzyć ankietę, aby zobaczyć status.'
          : 'Kupiona analiza jest gotowa. Kliknij poniżej, aby przejść do ankiety.';
      } else {
        status.textContent = data.customerEmail
          ? 'Potwierdzenie zostanie wysłane na: ' + data.customerEmail
          : 'Potwierdzenie otrzymasz na podany adres e-mail.';
      }
    } else {
      message.textContent = 'Płatność nie została jeszcze potwierdzona.';
      status.textContent = 'Odśwież stronę za chwilę.';
    }
  } catch (error) {
    message.textContent = 'Nie udało się sprawdzić statusu płatności.';
    status.textContent = error.message;
  }
}

checkSession();

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

      const analysisAccesses = Array.isArray(data.analysisAccesses)
        ? data.analysisAccesses
        : (data.analysisAccess ? [data.analysisAccess] : []);

      if (analysisAccesses.length) {
        const accessList = document.getElementById('analysis-access-list');
        accessList.innerHTML = '';

        analysisAccesses.forEach((item, index) => {
          const access = {
            purchaseId: item.purchaseId,
            accessToken: item.accessToken
          };

          const target = new URL('ankieta.html', window.location.href);
          target.searchParams.set('purchase_id', access.purchaseId);
          target.searchParams.set('access_token', access.accessToken);

          const link = document.createElement('a');
          link.className = 'analysis-access';
          link.href = target.toString();
          link.textContent = analysisAccesses.length === 1
            ? 'Przejdź do ankiety analizy'
            : `Przejdź do analizy ${index + 1}`;
          link.addEventListener('click', () => {
            localStorage.setItem(ANALYSIS_ACCESS_KEY, JSON.stringify(access));
          });
          accessList.appendChild(link);
        });

        if (analysisAccesses.length === 1) {
          const access = {
            purchaseId: analysisAccesses[0].purchaseId,
            accessToken: analysisAccesses[0].accessToken
          };
          localStorage.setItem(ANALYSIS_ACCESS_KEY, JSON.stringify(access));
        }

        analysisLink.hidden = true;
        status.textContent = analysisAccesses.length === 1
          ? (analysisAccesses[0].status === 'submitted'
              ? 'Ta analiza została już wcześniej wysłana. Możesz otworzyć ankietę, aby zobaczyć status.'
              : 'Kupiona analiza jest gotowa. Kliknij poniżej, aby przejść do ankiety.')
          : `Kupiono ${analysisAccesses.length} analizy. Każdy przycisk prowadzi do osobnej ankiety.`;
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

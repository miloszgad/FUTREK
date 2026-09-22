const IS_LOCAL_PREVIEW = window.location.protocol === 'file:';
const ANALYSIS_ACCESS_KEY = 'futrek_analysis_purchase_access_v1';
const sessionId = new URLSearchParams(window.location.search).get('session_id');

async function checkSession(attempt = 0) {
  const message = document.getElementById('message');
  const status = document.getElementById('status');
  const analysisLink = document.getElementById('analysis-access-link');
  const backLink = document.querySelector('.back-link');

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
        document.getElementById('analysis-access-warning').hidden = false;
        const accessList = document.getElementById('analysis-access-list');
        accessList.replaceChildren();

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
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'analysis-copy-link';
          copy.textContent = 'Skopiuj prywatny link do analizy';
          copy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(target.toString()); copy.textContent = 'Link skopiowany'; }
            catch {
              const helper = document.createElement('textarea');
              helper.value = target.toString();
              helper.style.position = 'fixed';
              helper.style.opacity = '0';
              document.body.appendChild(helper);
              helper.select();
              let copied = false;
              try { copied = document.execCommand('copy'); } catch {}
              helper.remove();
              copy.textContent = copied ? 'Link skopiowany' : 'Nie udało się skopiować — nie zamykaj tej karty';
            }
          });
          accessList.appendChild(copy);
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
      // Dopiero po potwierdzeniu płatności i przygotowaniu przycisków analizy.
      backLink.hidden = false;
    } else {
      message.textContent = 'Płatność nie została jeszcze potwierdzona.';
      status.textContent = attempt < 9 ? 'Czekamy na potwierdzenie płatności…' : 'Potwierdzenie się opóźnia. Odśwież stronę za chwilę.';
      if (attempt < 9) setTimeout(() => checkSession(attempt + 1), 3000);
    }
  } catch (error) {
    message.textContent = 'Nie udało się sprawdzić statusu płatności.';
    status.textContent = error.message;
  }
}

checkSession();

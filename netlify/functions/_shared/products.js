const PRICE_BY_PRODUCT = Object.freeze({
  'wild-mentality': 'price_1UIaWXHduHJ2QTTSwqVSu7bV',
  'area-control': 'price_1UIaUvHduHJ2QTTSmpDgWbAR',
  'full-game-control': 'price_1UIaYKHduHJ2QTTSQOF81bV4',
  'build-your-team': 'price_1UIal0HduHJ2QTTSXAq2FEMg',
  'goal-machine': 'price_1UIaXbHduHJ2QTTSnxL3jzCv'
});

const ANALYSIS_PRODUCT_ID = 'build-your-team';
// Zachowujemy rozpoznawanie opłaconych sesji utworzonych przed zmianą ceny.
const LEGACY_ANALYSIS_PRICE_IDS = Object.freeze([
  PRICE_BY_PRODUCT[ANALYSIS_PRODUCT_ID],
  'price_1TkMdtHduHJ2QTTSmBPptM7q'
]);
const ANALYSIS_PRICE_ID = PRICE_BY_PRODUCT[ANALYSIS_PRODUCT_ID];

function getAnalysisQuantity(session, lineItems) {
  const items = lineItems.data || [];
  // Ceny 24,99 zł są ustalane wyłącznie przez serwer; metadane również ustala serwer.
  // Dodatkowo porównujemy dane z faktycznie opłaconymi pozycjami sesji Stripe.
  if (session.metadata?.source === 'futrek_cart') {
    const declared = Number(session.metadata?.analysis_quantity);
    if (Number.isInteger(declared) && declared >= 1 && declared <= 10) {
      const paidAtDiscount = items.some(item =>
        item.price?.unit_amount === 2499 &&
        item.price?.currency?.toLowerCase() === 'pln' &&
        Number(item.quantity) === declared &&
        item.description === '📊 ANALIZA SKŁADU'
      );
      if (paidAtDiscount) return declared;
    }
  }
  return items.filter(item => LEGACY_ANALYSIS_PRICE_IDS.includes(item.price?.id))
    .reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}

module.exports = {
  PRICE_BY_PRODUCT,
  ANALYSIS_PRODUCT_ID,
  ANALYSIS_PRICE_ID,
  getAnalysisQuantity
};

const PRICE_BY_PRODUCT = Object.freeze({
  'wild-mentality': 'price_1TkMkQHduHJ2QTTS4ZYujv7J',
  'area-control': 'price_1TkMjFHduHJ2QTTSXXqShAXy',
  'full-game-control': 'price_1TkMgmHduHJ2QTTSVJUF4zDM',
  'build-your-team': 'price_1TkMdtHduHJ2QTTSmBPptM7q',
  'goal-machine': 'price_1TQwhtHduHJ2QTTSJjUAJn0F'
});

const ANALYSIS_PRODUCT_ID = 'build-your-team';
const ANALYSIS_PRICE_ID = PRICE_BY_PRODUCT[ANALYSIS_PRODUCT_ID];

module.exports = {
  PRICE_BY_PRODUCT,
  ANALYSIS_PRODUCT_ID,
  ANALYSIS_PRICE_ID
};

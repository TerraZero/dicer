const OptimizeValues = require('../OptimizeValues');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  const ov = new OptimizeValues();

  ov.addValue('v', 0, 100);
  ov.addValue('v2', 0, 100);
  ov.addValue('r', 0, 100);
  ov.addValue('b', 0, 50, (v) => {
    return v % 2 === 0 ? v : v + 1;
  });

  ov.execute(() => {
    const formel = 100 - (70 * ov.get('v') / 100) - (30 * ov.get('v2') / 100) + (200 * ov.get('r') / 100) - (1000 * ov.get('b') - 50000);
    console.log(ov.iteration, ov.get('v'), ov.get('v2'), ov.get('r'), ov.get('b'), formel);
    return formel;
  }, (ov, result) => result === 0, 50);

}


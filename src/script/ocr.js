const CV = require('opencv4nodejs');
const Tesseract = require('tesseract.js');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  const original = CV.imread(util.getPath('images/dices/d20.jpg'));

  let edit = original.cvtColor(CV.COLOR_BGR2GRAY);

  edit = edit.canny(150, 250);

  let contours = edit.findContours(CV.RETR_TREE, CV.CHAIN_APPROX_SIMPLE);
  contours = util.filterContours(contours, {
    size: {
      max: 20000,
    },
    focus: {
      point: util.getCenter(original),
      dist: 100,
    },
  });

  contours.forEach(v => {
    util.drawRotatedRect(original, v.minAreaRect());
  });
  
  CV.imwrite(util.getResultPath('result.jpg'), original);
  return;

  (async () => {
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(util.getPath('images/dices/d20.jpg'), {
      rectangle: { top: original.sizes[0] / 2 - size / 2, left: original.sizes[1] / 2 - size / 2, width: size, height: size },
    });
    console.log(text);
    await worker.terminate();
  })();
};

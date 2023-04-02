const CV = require('opencv4nodejs');
const Tesseract = require('tesseract.js');
const Sharp = require('sharp');

/**
 * @param {import('../Util')} util 
 */
module.exports = async (util) => {
  const path = util.getPath('images/dices/d20.jpg');
  const target = util.getResultPath('test.jpg');
  await Sharp(path).extract({
    top: 200,
    left: 160,
    width: 140,
    height: 100,
  })
  .grayscale()
  .threshold()
  .rotate(140)
  .toFile(target);
  const buffer = await Sharp(target).toBuffer();
  /*
  const image = CV.imread(util.getResultPath('test.jpg'));
  const rect = util.getRect({ center: util.getCenter(image).add(new CV.Point2(-25, 10)), size: { width: 130, height: 100 } });
  util.draw(image, rect);
  CV.imwrite(util.getResultPath('result.jpg'), image);
  */

  console.log(await util.detect(buffer));
  const number = await util.recognizeDigits(buffer);
  console.log(number);
  /*
  util.findText(target).then((text) => {
    console.log('Found:', text);
  });
  */
};

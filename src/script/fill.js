const CV = require('opencv4nodejs');
const Sharp = require('sharp');

/**
 * @param {import('../Util')} util 
 */
module.exports = async (util) => {
  const file = util.getPath('images/dices/digit-one.jpg');
  const original = util.paint().from(file);
  original.to('tmp-before.jpg');
  const size = 8;
  const kernel = CV.Mat.eye(size, size, CV.CV_8U);
  
  const mat = original.threshold().to('tmp-edit.jpg').getContext().morphologyEx(kernel, CV.MORPH_CLOSE);
  original.context(mat).to('tmp-after.jpg');
  const buffer = await Sharp(util.getResultPath('tmp-after.jpg')).toBuffer();
  const number = await util.recognize(buffer);
  console.log(number);
};

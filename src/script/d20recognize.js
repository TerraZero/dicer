const CV = require('opencv4nodejs');
const OptimizeValues = require('../OptimizeValues');
const FS = require('fs');
const Sharp = require('sharp');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  const file = util.getPath('images/dices/samples/sample-6.JPG');
  const original = util.paint().from(file);
  const image = util.paint().from(file);
  
  image
    .to('dices-original.jpg')
    .greyscale()
    .blur(3, 10)
    .threshold()
    .canny(100, 200, 3, false)
    .to('dices-edit.jpg');
  const contours = image.getFindContours(CV.RETR_CCOMP, CV.CHAIN_APPROX_SIMPLE);
  console.log(contours.length);
};

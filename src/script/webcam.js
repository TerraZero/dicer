const CV = require('opencv4nodejs');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  const video = new CV.VideoCapture(0);

  setInterval(function() {
    const image = video.read();
    CV.imwrite(util.getResultPath('result.jpg'), image);
  }, 1000);
}


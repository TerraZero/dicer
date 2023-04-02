const CV = require('opencv4nodejs');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  const image = CV.imread(util.getPath('images/dices/many.jpg'));

  CV.imwrite(util.getResultPath('result-step-1.jpg'), image);

  const greyImage = image.cvtColor(CV.COLOR_BGR2GRAY);

  CV.imwrite(util.getResultPath('result-step-2.jpg'), greyImage);

  const blurGreyImage = greyImage.blur(new CV.Size(1, 1));

  CV.imwrite(util.getResultPath('result-step-3.jpg'), blurGreyImage);

  const thresholdBlurGreyImage = greyImage.threshold(170, 255, CV.THRESH_BINARY);

  CV.imwrite(util.getResultPath('result-step-4.jpg'), thresholdBlurGreyImage);

  const cannyThresholdBlurGreyImage = thresholdBlurGreyImage.canny(80, 230);

  CV.imwrite(util.getResultPath('result-step-5.jpg'), cannyThresholdBlurGreyImage);

  const contours = cannyThresholdBlurGreyImage.findContours(CV.RETR_TREE, CV.CHAIN_APPROX_SIMPLE);

  const firstStepImage = image.copy();

  const rects = [];
  for (const contour of contours) {
    const rect = contour.minAreaRect();
    
    // skip to small rects
    if (rect.size.height * rect.size.width < 2000) continue;
    // skip all rects that are not quarders
    if (Math.abs(rect.size.width / rect.size.height - 1) > 0.25) continue;
    // skip duplicates
    if (!rects.reduce((v, r) => {
      return v && util.getDist(rect.center, r.center) > 10;
    }, true)) continue;

    rects.push(rect);

    firstStepImage.drawRectangle(rect.boundingRect(), new CV.Vec3(0, 0, 255), 2, CV.LINE_AA);

    util.drawRotatedRect(image, rect);
  }

  CV.imwrite(util.getResultPath('result-step-6.jpg'), firstStepImage);
  const correct = [2, 6, 4, 2, 6, 4, 2, 1, 1, 4, 1, 6, 3, 5, 4, 1, 1, 2, 5, 1, 1, 4, 4, 6, 6, 2, 6, 3, 2, 2, 5, 4, 2];
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const rotate = CV.getRotationMatrix2D(rect.center, rect.angle);
    const rotateDice = thresholdBlurGreyImage.warpAffine(rotate);
    const dice = rotateDice.getRegion(util.rectScale(rect.boundingRect(), -5));
    
    CV.imwrite(util.getResultPath('result-step-dice-' + i + '.jpg'), dice);

    const diceThreshold = dice.threshold(200, 255, CV.THRESH_BINARY);
    const diceContours = diceThreshold.findContours(CV.RETR_TREE, CV.CHAIN_APPROX_SIMPLE);

    const pRects = [];
    for (const diceContour of diceContours) {
      const pRect = diceContour.minAreaRect();

      if (Math.abs(pRect.size.width / pRect.size.height - 1) > 0.4) continue;

      if (diceContour.area < 50 || diceContour.area > 175) continue;

      if (!pRects.reduce((v, r) => {
        return v && util.getDist(pRect.center, r.center) > 10;
      }, true)) continue;

      dice.drawRectangle(pRect.boundingRect(), new CV.Vec3(0, 0, 255), 2, CV.LINE_AA);
      pRects.push(pRect);
    }

    CV.imwrite(util.getResultPath('result-step-dice-' + i + '.jpg'), dice);
    const color = (pRects.length === correct[i]) ? new CV.Vec3(0, 255, 0) : new CV.Vec3(255, 0, 0);
    image.putText(pRects.length + ' - ' + i, rect.center, CV.FONT_HERSHEY_PLAIN, 1, color, 2);
  }

  CV.imwrite(util.getResultPath('result-step-7.jpg'), image);
};

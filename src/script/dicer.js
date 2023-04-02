const CV = require('opencv4nodejs');
const OptimizeValues = require('../OptimizeValues');
const FS = require('fs');
const Sharp = require('sharp');

/**
 * @param {import('../Util')} util 
 */
module.exports = (util) => {
  execute(util, util.getPath('images/dices/samples/sample-6.JPG'));
};

/**
 * @param {import('../Util')} util 
 * @param {CV.Contour[]} contours
 */
function getFilterContours(util, contours) {
  return util.filterContours(contours, {
    size: {
      min: 60000,
      max: 200000,
    },
    ratio: 0.5,
    dist: 100,
  });
}

/**
 * @param {import('../Util')} util 
 * @param {string} file
 */
async function execute(util, file) {
  const ov = new OptimizeValues('dicer', util.getPath('info/optimize'));
  
  ov.addValue('blur', 3, 31, v => v % 2 === 0 ? v + 1 : v);
  ov.addValue('threshold', 50, 150);
  ov.addValue('canny1', 50, 200);
  ov.addValue('canny2', 50, 200);

  let contours = [];
  let filterContours = [];
  /** @type {import('../Paintable')} */
  let original = null;
  ov.execute(() => {
    ov.info();
    original = util.paint().from(file).resize(2.22);

    contours = original
      .to('result.jpg')
      .greyscale()
      .blur([ov.get('blur'), ov.get('blur')], 15)
      .to('result-grey.jpg')
      .threshold(ov.get('threshold'))
      .to('result-thresh.jpg')
      .canny(ov.get('canny1'), ov.get('canny2'))
      .to('result-edit.jpg')
      .findContours();

    return contours.length;
  }, (ov, r) => {
    if (r < 100) {
      return getFilterContours(util, contours).length === 10;
    }
    return false;
  }, 1000);
  
  console.log(contours.length);
  filterContours = getFilterContours(util, contours);
  console.log(filterContours.length);
  original.resetContext();

  for (const index in filterContours) {
    const contour = filterContours[5];

    // util.paint(contour.minAreaRect()).red().thickness(5).draw(original);
    // util.paint(contour.minAreaRect().boundingRect()).thickness(5).draw(original);

    const diceMat = original
      .resetContext()
      .rect(contour.minAreaRect())
      .rotateEven()
      .green()
      .thickness(5)
      .fit()
      .draw()
      .rect(contour.minAreaRect().boundingRect())
      .fit()
      .red()
      .thickness(5)
      .text(index, 10, 'left', 'top')
      .to('result-found.jpg')
      .getExtract();

    const dice = util.paint().context(diceMat)
      .to('tmp-' + index + '-original.jpg')
      .greyscale()
      .to('tmp-' + index + '-greyscale.jpg')
      .blur([11, 11], 10)
      .to('tmp-' + index + '-blur.jpg')
      .threshold(150)
      .to('tmp-' + index + '-threshold.jpg')
      // .canny(ov.get('canny1'), ov.get('canny2'))
      .to('tmp-' + index + '.jpg')
      .red();

    let numbers = dice.findContours();

    console.log(numbers.length);
    util.filterContours(numbers, {
      size: {
        min: 2000,
        max: 8000,
      },
    }).forEach((c) => {
      dice.resetContext()
        .rect(c.minAreaRect())
        .red()
        .to('tmp-' + index + '-test.jpg')
        .rect(util.rectScale(c.minAreaRect().boundingRect(), '20%'))
        .to('tmp-' + index + '-found.jpg')
        .extract()
        .thresholdMask()
        .to('tmp-' + index + '-number.jpg');
    });
    console.log(numbers.length);
    console.log(numbers);
    
    original.rect(numbers)

    // const dice = util.paint({ rect: contour.minAreaRect().boundingRect(), context: original });
    // util.paint({ rect: contour.minAreaRect(), context: original }).green().thickness(5).fit().draw();

    // util.paint().context(dice.fit().extract()).to('tmp-' + index + '.jpg');

    const sharp = await Sharp(util.getResultPath('tmp-' + index + '-number.jpg')).blur(2).threshold();
    await sharp.toFile(util.getResultPath('tmp-' + index + '-sharp.jpg'));
    const buffer = await sharp.toBuffer();
    const number = await util.recognizeDigits(buffer);
    const text = await util.recognize(buffer);
    original.rect(contour.minAreaRect().boundingRect()).thickness(5).text(number + '-' + text.data.text);
    // original.getContext().putText(number + '-' + text.data.text, new CV.Point2(dice.rect.x, dice.rect.y), CV.FONT_HERSHEY_PLAIN, 10, new CV.Vec3(0, 0, 255), 5);
    console.log('DIGITS:', index, number);
    break;
  }

  const history = require(util.getPath('results/dicer/results.json'));
  history.push({
    input: { file },
    output: ov.data,
    config: ov.values,
    iteration: ov.iteration,
    result: {
      items: contours.length,
      filter: filterContours.length,
    },
  });
  FS.writeFileSync(util.getPath('results/dicer/results.json'), JSON.stringify(history, null, 2));
  original.resetContext().to('result-found.jpg');
}

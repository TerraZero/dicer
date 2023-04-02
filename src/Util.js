const Path = require('path');
const FS = require('fs');

const CV = require('opencv4nodejs');
const Tesseract = require('tesseract.js');

const Paintable = require('./Paintable');

/**
 * @typedef {(CV.Rect|CV.RotatedRect|CV.Mat|CV.Size|number[]|number)} T_Sizeable
 */

module.exports = class Util {

  /**
   * @param {string} root
   * @param {string} path 
   */
  static prepareDir(root, path) {
    root = Path.normalize(root);
    path = Path.dirname(Path.normalize(path));
    if (path.startsWith(root)) {
      path = path.substring(root.length);
    }
    
    let file = root;
    for (const part of path.split(Path.sep)) {
      file = Path.join(file, part);
      if (!FS.existsSync(file)) {
        FS.mkdirSync(file);
      }
    }
  }

  constructor(script) {
    this.script = script;
    this.root = Path.join(__dirname, '..');
    this.worker = null;
  }

  /**
   * @param {Paintable.T_PaintableOptions} options 
   * @returns {Paintable}
   */
  paint(options) {
    return new Paintable(this, options);
  }

  getPath(...path) {
    const p = Path.join(...path);
    if (p.startsWith(this.root)) return p;
    return Path.join(this.root, ...path);
  }

  getResultPath(...path) {
    const target = Path.join('results', this.script, ...path);
    Util.prepareDir(this.root, target);
    return Path.join(this.root, target);
  }

  /**
   * @param {CV.RotatedRect} rect 
   * @returns {CV.Point2[]}
   */
  getPoints(rect) {
    const rw = rect.size.width / 2;
    const rh = rect.size.height / 2;
    const a = rect.angle * (Math.PI / 180);
    const points = [
      [rect.center.x - rw - rect.center.x, rect.center.y - rh - rect.center.y],
      [rect.center.x + rw - rect.center.x, rect.center.y - rh - rect.center.y],
      [rect.center.x + rw - rect.center.x, rect.center.y + rh - rect.center.y],
      [rect.center.x - rw - rect.center.x, rect.center.y + rh - rect.center.y],
    ];

    return points.map(point => {
      return new CV.Point2(
        point[0] * Math.cos(a) - point[1] * Math.sin(a) + rect.center.x,
        point[0] * Math.sin(a) + point[1] * Math.cos(a) + rect.center.y
      );
    });
  }

  /**
   * 
   * @param {CV.Point2} point1 
   * @param {CV.Point2} point2 
   * @returns {number}
   */
  getDist(point1, point2) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  }

  /**
   * @param {CV.Rect} rect 
   * @param {(string|number)} factor '10%', '10px', 10
   * @returns {CV.Rect}
   */
  rectScale(rect, factor) {
    if (rect instanceof CV.RotatedRect) rect = rect.boundingRect();
    let factorX = parseInt(factor);
    let factorY = parseInt(factor);
    if (typeof factor === 'string' && factor.endsWith('%')) {
      factorX = rect.width * parseFloat(factor) / 200;
      factorY = rect.height * parseFloat(factor) / 200;
    }
    return new CV.Rect(rect.x - factorX, rect.y - factorY, rect.width + factorX * 2, rect.height + factorY * 2);
  }

  /**
   * @param {CV.Mat} image 
   * @param {(CV.Rect|CV.RotatedRect)} object 
   * @param {CV.Vec3} color 
   * @param {number} thickness 
   */
  draw(image, object, color = null, thickness = 2) {
    if (object instanceof CV.Rect) {
      this.drawRect(image, object, color, thickness);
    } else if (object instanceof CV.RotatedRect) {
      this.drawRotatedRect(image, object, color, thickness);
    } else {
      throw new Error('Unknown object type to draw.');
    }
  }

  /**
   * @param {CV.Mat} image
   * @param {CV.Rect} rect 
   * @param {CV.Vec3} color 
   * @param {number} thickness 
   */
  drawRect(image, rect, color = null, thickness = 2) {
    if (color === null) color = new CV.Vec3(0, 0, 255);
    image.drawRectangle(new CV.Point2(rect.x, rect.y), new CV.Point2(rect.x + rect.width, rect.y + rect.height), color, thickness);
  }

  /**
   * @param {CV.Mat} image
   * @param {CV.RotatedRect} rect 
   * @param {CV.Vec3} color 
   * @param {number} thickness 
   */
  drawRotatedRect(image, rect, color = null, thickness = 2) {
    if (color === null) color = new CV.Vec3(0, 0, 255);
    const points = this.getPoints(rect);
    for (let i = 0; i < points.length; i++) {
      image.drawLine(points[i], points[(i + 1) % points.length], color, thickness, CV.LINE_AA);
    }
  }

  /**
   * @param {CV.Rect} rect 
   * @param {CV.Size} size 
   * @param {boolean} shrink
   * @returns {CV.Rect}
   */
  fitRect(rect, size, shrink = true) {
    // TODO: add shrink false support
    if (shrink === false) throw new Error('TODO: Shrink = false option are not yet supported');
    let newRect = [];
  
    newRect.push(rect.x < 0 ? 0 : rect.x > size.width ? size.width : rect.x);
    newRect.push(rect.y < 0 ? 0 : rect.y > size.height ? size.height : rect.y);
    newRect.push(newRect[0] + rect.width > size.width ? size.width - newRect[0] : rect.width);
    newRect.push(newRect[1] + rect.height > size.height ? size.height - newRect[1] : rect.height);
    
    return new CV.Rect(...newRect);
  }

  /**
   * @typedef {Object} T_FilterContoursOptions
   * @property {Object} [size]
   * @property {number} [size.min]
   * @property {number} [size.max]
   * @property {number} [ratio]
   * @property {Object} [focus]
   * @property {CV.Point2} [focus.point]
   * @property {number} [focus.dist]
   * @property {number} [dist]
   */

  /**
   * @param {CV.Contour[]} contours 
   * @param {T_FilterContoursOptions} options 
   * @returns {CV.Contour[]}
   */
  filterContours(contours, options = {}) {
    const filtered = [];
    for (const contour of contours) {
      const rect = contour.minAreaRect();
      
      if (options.size) {
        const size = rect.size.width * rect.size.height;
        if (size < (options.size.min || 0) || size > (options.size.max || Infinity)) continue;
      }

      if (options.ratio) {
        if (Math.abs(rect.size.width / rect.size.height - 1) > options.ratio) continue;
      }

      if (options.focus) {
        if (this.getDist(rect.center, options.focus.point) > (options.focus.dist || 10)) continue;
      }

      if (!filtered.reduce((v, r) => {
        return v && this.getDist(rect.center, r.minAreaRect().center) > (options.dist || 10);
      }, true)) continue;

      filtered.push(contour);
    }
    return filtered;
  }

  /**
   * @param {CV.Mat} image 
   * @returns {CV.Point2}
   */
  getCenter(image) {
    return new CV.Point2(image.sizes[0] / 2, image.sizes[1] / 2);
  }

  /**
   * @typedef {Object} T_RectGeneratorOptions
   * @property {CV.Point2} center
   * @property {CV.Size} size
   */

  /**
   * @param {T_RectGeneratorOptions} options 
   * @returns {CV.Rect}
   */
  getRect(options) {
    if (options.center && options.size) {
      return new CV.Rect(
        options.center.x - options.size.width / 2,
        options.center.y - options.size.height / 2,
        options.size.width,
        options.size.height
      );
    }
  }

  async getWorker() {
    if (this.worker === null) {
      this.worker = Tesseract.createWorker({
        langPath: 'https://file-1252889006.cos.ap-guangzhou.myqcloud.com/tesseract',
      });
      await this.worker.load();
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng', Tesseract.OEM.TESSERACT_ONLY);
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        tessedit_char_whitelist: '0123456789',
      });
    }
    return this.worker;
  }

  /**
   * @param {Tesseract.ImageLike} image 
   * @returns {Promise<Tesseract.DetectResult>}
   */
  async detect(image) {
    return (await this.getWorker()).detect(image);
  }

  /**
   * @param {Tesseract.ImageLike} image 
   * @param {CV.Rect} rect 
   * @returns {Promise<Tesseract.RecognizeResult>}
   */
  async recognize(image, rect = null) {
    const options = {};

    if (rect !== null) {
      options.rectangle = {
        top: rect.y,
        left: rect.x,
        width: rect.width,
        height: rect.height,
      };
    }
    
    return (await this.getWorker()).recognize(image, options);
  }

  /**
   * @param {Tesseract.ImageLike} image 
   * @param {CV.Rect} rect 
   * @returns {Promise<number>}
   */
  async recognizeDigits(image, rect = null) {
    const { data: { text } } = await this.recognize(image, rect);
    return Number.parseInt(text.replace(/[^0-9]/g, ''));
  }

  /**
   * @param {T_Sizeable} object 
   * @param {boolean} required Trigger error when transform are not supported
   * @returns {(CV.Size|null)}
   */
  toSize(object, required = false) {
    if (object instanceof CV.Rect) {
      return new CV.Size(object.width, object.height);
    } else if (object instanceof CV.RotatedRect) {
      return object.size;
    } else if (object instanceof CV.Mat) {
      return new CV.Size(...object.sizes.reverse());
    } else if (object instanceof CV.Size) {
      return object;
    } else if (Array.isArray(object)) {
      return new CV.Size(object[0], object[1]);
    } else if (typeof object === 'number') {
      return new CV.Size(object, object);
    }
    if (required) throw new Error('Object ' + object.constructor.name + ' is not sizeable.');
    return null;
  }

}
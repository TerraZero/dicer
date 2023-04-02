const CV = require('opencv4nodejs');

/**
 * @typedef {Object} T_PaintableOptions
 * @property {(CV.Rect|CV.RotatedRect)} rect
 * @property {(CV.Mat|Paintable)} context
 */

module.exports = class Paintable {

  /**
   * @param {import('./Util')} util
   * @param {T_PaintableOptions} options 
   */
  constructor(util, options = {}) {
    this.util = util;
    this._rect = options.rect || null;
    this._context = null;
    this.context(options.context);
    this._thickness = 1;
    this._color = new CV.Vec3(0, 0, 0);

    this._processed_rect = null;
    this._processed_context = null;
  }

  /** 
   * @returns {(CV.RotatedRect|CV.Rect)} 
   */
  getRect() {
    if (this._processed_rect !== null) return this._processed_rect;
    return this._rect;
  }

  /** 
   * @returns {CV.Mat} 
   */
  getContext() {
    if (this._context === null) throw new Error('Paintable need a context to perform the task.');
    if (this._processed_context !== null) return this._processed_context;
    return this._context;
  }

  /**
   * @param {(CV.Rect|CV.RotatedRect)} rect 
   * @returns {this}
   */
  rect(rect) {
    this._rect = rect;
    this._processed_rect = null;
    return this;
  }

  /**
   * @param {(CV.Mat|Paintable)} context 
   * @returns {this}
   */
  context(context = null) {
    if (context instanceof Paintable) {
      this._context = context.getContext();
    } else {
      this._context = context;
    }
    this._processed_context = null;
    return this;
  }

  /**
   * @param {...string} path 
   * @returns {this}
   */
  from(...path) {
    this._context = CV.imread(this.util.getPath(...path));
    this._processed_context = null;
    return this;
  }

  /**
   * @param  {...string} path 
   * @returns {this}
   */
  to(...path) {
    CV.imwrite(this.util.getResultPath(...path), this.getContext());
    return this;
  }

  /**
   * @param {number} thickness 
   * @returns {this}
   */
  thickness(thickness) {
    this._thickness = thickness;
    return this;
  }

  /**
   * @param {(number|CV.Vec3)} b 
   * @param {number} g 
   * @param {number} r 
   * @returns {this}
   */
  color(b = 0, g = 0, r = 0) {
    if (b instanceof CV.Vec3) {
      this._color = b;
    } else {
      this._color = new CV.Vec3(b, g, r);
    }
    return this;
  }

  /**
   * @returns {this}
   */
  blue() {
    this.color(255, 0, 0);
    return this;
  }

  /**
   * @returns {this}
   */
  green() {
    this.color(0, 255, 0);
    return this;
  }

  /**
   * @returns {this}
   */
  red() {
    this.color(0, 0, 255);
    return this;
  }

  /**
   * @returns {this}
   */
  black() {
    this.color(0, 0, 0);
    return this;
  }

  /**
   * @returns {this}
   */
  white() {
    this.color(255, 255, 255);
    return this;
  }

  /**
   * @param {import('./Util').T_Sizeable} sizeable
   * @param {boolean} shrink
   * @returns {this}
   */
  fit(sizeable = null, shrink = true) {
    if (!(this.getRect() instanceof CV.Rect)) return this;
    if (sizeable === null) sizeable = this.getContext();
    const size = this.util.toSize(sizeable, true);

    let newRect = [];
  
    if (shrink) {
      newRect.push(this.getRect().x < 0 ? 0 : this.getRect().x > size.width ? size.width : this.getRect().x);
      newRect.push(this.getRect().y < 0 ? 0 : this.getRect().y > size.height ? size.height : this.getRect().y);
      newRect.push(newRect[0] + this.getRect().width > size.width ? size.width - newRect[0] : this.getRect().width);
      newRect.push(newRect[1] + this.getRect().height > size.height ? size.height - newRect[1] : this.getRect().height);
    } else {
      newRect = [0, 0, 0, 0];
      if (this.getRect().x > 0) newRect[0] = this.getRect().x;
      if (this.getRect().y > 0) newRect[1] = this.getRect().y;
      if (this.getRect().width > size.width) {
        newRect[0] = 0;
        newRect[2] = size.width;
      } else if (newRect[0] + this.getRect().width > size.width) {
        newRect[0] = size.width - this.getRect().width;
        newRect[2] = this.getRect().width;
      } else {
        newRect[2] = this.getRect().width;
      }
      if (this.getRect().height > size.height) {
        newRect[1] = 0;
        newRect[3] = size.height; 
      } else if (newRect[1] + this.getRect().height > size.height) {
        newRect[1] = size.height - this.getRect().height;
        newRect[3] = this.getRect().height;
      } else {
        newRect[3] = this.getRect().height;
      }
    }

    this._processed_rect = new CV.Rect(...newRect);

    return this;
  }

  /**
   * @returns {this}
   */
  resetRect() {
    this._processed_rect = null;
    return this;
  }

  /**
   * @returns {this}
   */
  resetContext() {
    this._processed_context = null;
    return this;
  }

  /**
   * @param {CV.Mat} context
   * @param {(CV.Rect|CV.RotatedRect)} rect
   * @returns {this}
   */
  extract(context = null, rect = null) {
    this._processed_context = this.getExtract(context, rect);
    return this;
  }

  /**
   * @param {CV.Mat} context
   * @param {(CV.Rect|CV.RotatedRect)} rect
   * @returns {CV.Mat}
   */
  getExtract(context = null, rect = null) {
    context = context || this.getContext();
    rect = rect || this.getRect();

    if (rect instanceof CV.RotatedRect) {
      return context.getRegion(rect.boundingRect());
    } else {
      return context.getRegion(rect);
    }
  }

  /**
   * @param {CV.Mat} context
   * @param {(CV.Rect|CV.RotatedRect)} rect
   * @returns {this}
   */
  draw(context = null, rect = null) {
    context = context || this.getContext();
    rect = rect || this.getRect();
    if (rect instanceof CV.Rect) {
      context.drawRectangle(new CV.Point2(rect.x, rect.y), new CV.Point2(rect.x + rect.width, rect.y + rect.height), this._color, this._thickness);
    } else if (rect instanceof CV.RotatedRect) {
      this.util.drawRotatedRect(context, rect, this._color, this._thickness);
    }
    return this;
  }

  /**
   * @param {number} threshold 
   * @returns {this}
   */
  threshold(threshold = 128) {
    this._processed_context = this.getContext().threshold(threshold, 255, CV.THRESH_BINARY);
    return this;
  }

  /**
   * @returns {this}
   */
  greyscale() {
    this._processed_context = this.getContext().cvtColor(CV.COLOR_BGR2GRAY);
    return this;
  }

  /**
   * @param {import('./Util').T_Sizeable} sizeable
   * @param {number} sigma
   * @returns {this}
   */
  blur(sizeable, sigma) {
    this._processed_context = this.getContext().gaussianBlur(this.util.toSize(sizeable, true), sigma);
    return this;
  }

  /**
   * @param {number} threshold1 
   * @param {number} threshold2 
   * @param {number} apertureSize
   * @param {boolean} l2gradient
   * @returns {this}
   */
  canny(threshold1, threshold2, apertureSize = undefined, l2gradient = undefined) {
    this._processed_context = this.getContext().canny(threshold1, threshold2, apertureSize, l2gradient);
    return this;
  }

  /**
   * @param {number} mode
   * @param {number} method
   * @returns {CV.Contour[]}
   */
  getFindContours(mode = CV.RETR_TREE, method = CV.CHAIN_APPROX_SIMPLE) {
    return this.getContext().findContours(mode, method);
  }

  /**
   * @param {number} factor 
   * @returns {this}
   */
  resize(factor) {
    this._processed_context = this.getContext().resize(this.getContext().sizes[0], this.getContext().sizes[1], factor, factor, CV.INTER_LANCZOS4);
    return this;
  }

  /**
   * @param {(number|string)} position_x 
   * @param {(number|string)} position_y 
   * @param {boolean} absolute 
   * @returns {CV.Point2}
   */
  getPoint(position_x = 'center', position_y = null, absolute = false) {
    let context = null;
    if (absolute) {
      const size = this.util.toSize(this.getContext());
      context = new CV.Rect(0, 0, size.width, size.height);
    } else {
      context = this.getRect();
      if (context instanceof CV.RotatedRect) {
        context = context.boundingRect();
      }
    }
    if (position_y === null) position_y = position_x;
    if (typeof position_x === 'string') {
      switch (position_x) {
        case 'left':
          position_x = context.x;
          break;
        case 'center':
        case 'middle':
          position_x = context.x + context.width / 2;
          break;
        case 'right':
          position_x = context.x + context.width;
          break;
        default:
          throw new Error('Unknown width-position "' + position_x + '"');
      }
    }
    if (typeof position_y === 'string') {
      switch (position_y) {
        case 'top':
          position_y = context.y;
          break;
        case 'center':
        case 'middle':
          position_y = context.y + context.height / 2;
          break;
        case 'left':
          position_y = context.y + context.height;
          break;
        default:
          throw new Error('Unknown height-position "' + position_y + '"');
      }
    }
    return new CV.Point2(position_x, position_y);
  }

  /**
   * @param {string} text 
   * @param {number} fontSize
   * @param {(number|string)} position_x 
   * @param {(number|string)} position_y 
   * @param {boolean} absolute 
   * @returns {this}
   */
  text(text, fontSize = 10, position_x = 'center', position_y = null, absolute = false) {
    this.getContext().putText(text + '', this.getPoint(position_x, position_y, absolute), CV.FONT_HERSHEY_PLAIN, fontSize, this._color, this._thickness);
    return this;
  }

  /**
   * @param {CV.RotatedRect} rect 
   * @returns {CV.Mat}
   */
  getEvenRotation(rect) {
    rect = rect || this.getRect();
    if (!(rect instanceof CV.RotatedRect)) throw new Error('Method "getEvenRotation()" is onyl supported with CV.RotatedRect');
    return CV.getRotationMatrix2D(rect.center, rect.angle);
  }

  /**
   * @param {CV.RotatedRect} rect 
   * @param {CV.Mat} rotation
   * @returns {this}
   */
  evenRotation(rect, rotation) {
    rotation = rotation || this.getEvenRotation(rect);
    this._processed_context = this.getContext().warpAffine(rotation);
    return this;
  }

  thresholdMask() {
    const lower = new CV.Vec3(0, 150, 150);
    const upper = new CV.Vec3(255, 255, 255);
    let mask = this.getContext().inRange(lower, upper);
    mask = mask.cvtColor(CV.COLOR_GRAY2BGR);
    this._processed_context = this.getContext().and(mask);
    return this;
  }

  /**
   * @returns {CV.Size}
   */
  getSize() {
    return this.util.toSize(this.getContext(), true);
  }

  /**
   * @returns {CV.Point2}
   */
  getCenter() {
    return new CV.Point2(this.getSize().width / 2, this.getSize().height / 2);
  }

}
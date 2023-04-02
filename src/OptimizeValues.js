const Path = require('path');
const FS = require('fs');

module.exports = class OptimizeValues {

  /**
   * @param {string} id 
   * @param {string} path
   */
  constructor(id = null, path = null) {
    this.id = id;
    this.path = path;
    this.iteration = 1;
    this.values = [];
    this.change = 0;
    this.step = 0;
    this.state = Infinity;

    this._reminds = null;
  }

  info(row = true) {
    const data = ['INFO(' + this.iteration + '):'];
    for (const value of this.values) {
      data.push(value.name + ':' + this.get(value.name));
    }
    data.push('RESULT:' + Math.round(this.state));
    console.log(...data);
  }

  addValue(name, min = 0, max = 255, preprocess = null) {
    this.values.push({
      name,
      min,
      max,
      preprocess: preprocess || ((v) => v),
      cMin: min,
      cMax: max,
    });
  }

  get current() {
    return this.values[this.change];
  }

  get data() {
    const data = {};
    for (const value of this.values) {
      data[value.name] = this.get(value.name);
    }
    return data;
  }

  /**
   * @returns {Array}
   */
  getReminds() {
    if (this._reminds === null) {
      if (this.id !== null && this.path !== null) {
        try {
          this._reminds = require(Path.join(this.path, this.id + '.json'));
        } catch (e) {}
      }
    }
    return this._reminds || [];
  }

  execute(tester, end = null, maxIteration = 1000, remind = 5) {
    this.iteration = 1;
    const originalTester = tester;
    tester = (() => Math.abs(originalTester(this)));
    if (typeof end === 'number') {
      const nEnd = end;
      end = (t, v) => v < nEnd;
    } else {
      end = end || (() => false);
    }

    let result = null;
    let test_result = tester();
    if (end(this, test_result)) result = { status: 'found', result: test_result };

    const reminds = this.getReminds();
    let bestRemind = -1;
    if (result === null && typeof remind === 'number') {
      for (let i = 0; i < remind; i++) {
        if (reminds.length <= i) break;
        for (const value of reminds[i].values) {
          const cValue = this.values.find(v => v.name === value.name);
          cValue.cMin = value.min;
          cValue.cMax = value.max;
        }
        const rResult = tester();
        if (end(this, rResult)) {
          result = { status: 'found', result: rResult };
          break;
        }
        if (rResult < test_result) {
          bestRemind = i;
          test_result = rResult;
        }
      }
    }

    if (result === null) {
      if (bestRemind === -1) {
        this.reset();
      } else {
        console.log('REMIND:', JSON.stringify(reminds[bestRemind].values));
        for (const value of reminds[bestRemind].values) {
          const cValue = this.values.find(v => v.name === value.name);
          cValue.cMin = value.min;
          cValue.cMax = value.max;
        }
      }
      result = this.doExecute(tester, end, maxIteration, test_result);
      console.log('RESULT:', result);
    }

    if (result.status === 'found') {
      if (bestRemind !== -1) {
        reminds[bestRemind].accept += (1 / this.iteration);
      }
      const found = reminds.findIndex(v => {
        for (const value of this.values) {
          if (Math.abs(v.values.find(v => v.name === value.name).min - value.cMin) > 5) return false;
          if (Math.abs(v.values.find(v => v.name === value.name).max - value.cMax) > 5) return false;
        }
        return true;
      });
      if (found === -1) {
        reminds.push({
          accept: 1,
          iteration: this.iteration,
          values: this.values.map(v => {
            return {
              name: v.name,
              min: v.cMin,
              max: v.cMax,
            };
          }),
        });
      } else {
        reminds[found].iteration = reminds[found].iteration > this.iteration ? this.iteration : reminds[found].iteration;
        reminds[found].accept++;
      }
      reminds.sort((a, b) => b.accept - a.accept);
      FS.writeFileSync(Path.join(this.path, this.id + '.json'), JSON.stringify(reminds, null, 2));
    }
    return result;
  }

  doExecute(tester, end, maxIteration, result) {
    const factors = [];
    for (let i = 0; i < this.values.length; i++) {
      this.change = i;
      this.current.cMin = this.get(this.current.name, 'ceil');

      const cResult = tester();
      if (end(this, cResult)) return { status: 'found', result: cResult };

      factors.push({
        index: i,
        factor: Math.abs(result - cResult),
        result: cResult,
      });
      this.current.cMin = this.current.min;
    }

    let value = null;
    let skip = false;
    let abort = false;
    do {
      if (skip) {
        skip = false;
      } else {
        value = factors.reduce((p, v) => p.factor > v.factor ? p : v);
      }

      this.change = value.index;
      const statMin = this.current.cMin;
      const statMax = this.current.cMax;

      this.current.cMin = this.get(this.current.name, false, 'ceil');
      const testUp = tester();
      if (end(this, testUp)) return { status: 'found', result: testUp };
      this.current.cMin = statMin;

      this.current.cMax = this.get(this.current.name, false);
      const testDown = tester();
      if (end(this, testDown)) return { status: 'found', result: testDown };
      this.current.cMax = statMax;

      if (testUp < result && testUp < testDown) {
        abort = false;
        value.factor = Math.abs(result - testUp);
        value.result = testUp;
        this.state = testUp;
        this.current.cMin = this.get(this.current.name, false, 'ceil');
      } else if (testDown < result && testDown < testUp) {
        abort = false;
        value.factor = Math.abs(result - testUp);
        value.result = testDown;
        this.state = testDown;
        this.current.cMax = this.get(this.current.name, false);
      } else {
        if (abort) return { status: 'abort', reason: 'Recursion' };
        abort = true;
        value.factor = 0;
        if (Math.max(factors.map(v => v.factor)) === 0) {
          skip = true;
          value = factors[(value.index + 1) % factors.length];
        }
      }
      this.iteration++;
    } while (this.iteration < maxIteration);
    return { status: 'abort', reason: 'Max iteration' };
  }

  get(name, preprocess = true, direction = 'floor') {
    const value = this.values.find(v => v.name === name);
    const result = Math[direction]((value.cMax - value.cMin) / 2) + value.cMin;
    return preprocess ? value.preprocess(result, value) : result;
  }

  reset(name = null) {
    if (name === null) {
      this.values.forEach(v => this.reset(v.name));
    } else {
      const value = this.values.find(v => v.name === name);
      value.cMin = value.min;
      value.cMax = value.max;
    }
    return this;
  }

};
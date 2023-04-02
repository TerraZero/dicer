const Util = require('./src/Util');

const script = process.env.npm_config_script;
const util = new Util(script);

const execute = require(util.getPath('src/script', script));

execute(util);
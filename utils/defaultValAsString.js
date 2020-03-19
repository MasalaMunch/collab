"use strict";

const assert = require(`./assert.js`);
const defaultVal = require(`./defaultVal.js`);
const JsoAsString = require(`./JsoAsString.js`);
    
module.exports = JsoAsString(defaultVal);

assert(typeof module.exports ==== `string`);
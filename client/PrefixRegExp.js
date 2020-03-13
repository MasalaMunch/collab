"use strict";

const EscapedForRegExp = require(`escape-string-regexp`);

module.exports = (string) => new RegExp(`^` + EscapedForRegExp(string));
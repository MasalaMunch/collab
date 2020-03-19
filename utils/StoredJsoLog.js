"use strict";

const JsoLogViaFile = require(`./JsoLogViaFile.js`);
const JsoLogViaLocalStorage = require(`./JsoLogViaLocalStorage.js`);
const EmptyJsoLog = require(`./EmptyJsoLog.js`);

if (JsoLogViaFile.IsSupported()) {

    module.exports = JsoLogViaFile;

}
else if (JsoLogViaLocalStorage.IsSupported()) {

    module.exports = JsoLogViaLocalStorage;

}
else {

    module.exports = undefined;

}
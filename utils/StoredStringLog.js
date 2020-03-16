"use strict";

const StringLogViaFile = require(`./StringLogViaFile.js`);
const StringLogViaLocalStorage = require(`./StringLogViaLocalStorage.js`);
const FakeLog = require(`./FakeLog.js`);

if (StringLogViaFile.IsSupported()) {

    module.exports = StringLogViaFile;

}
else if (StringLogViaLocalStorage.IsSupported()) {

    module.exports = StringLogViaLocalStorage;

}
else {

    module.exports = undefined;

}
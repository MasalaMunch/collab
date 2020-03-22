"use strict";

const StringLogViaFile = require(`./StringLogViaFile.js`);
const StringLogViaLocalStorage = require(`./StringLogViaLocalStorage.js`);

const IsSupported = (Log) => {

    return Log && typeof Log.IsSupported === `function` && Log.IsSupported();

};

if (IsSupported(StringLogViaFile)) {

    module.exports = StringLogViaFile;

}
else if (IsSupported(StringLogViaLocalStorage)) {

    module.exports = StringLogViaLocalStorage;

}
else {

    module.exports = undefined;

}
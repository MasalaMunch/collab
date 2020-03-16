"use strict";

const StoredStringLogViaFile = require(`./StoredStringLogViaFile.js`);
const StoredStringLogViaLocalStorage = require(`./StoredStringLogViaLocalStorage.js`);
const FakeStoredStringLog = require(`./FakeStoredStringLog.js`);

if (StoredStringLogViaFile.IsSupported()) {

    module.exports = StoredStringLogViaFile;

}
else if (StoredStringLogViaLocalStorage.IsSupported()) {

    module.exports = StoredStringLogViaLocalStorage;

}
else {

    module.exports = FakeStoredStringLog;

}
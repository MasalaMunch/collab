"use strict";

const StoredStringLog = require(`./StoredStringLog.js`);

module.exports = class {

    constructor ({path}) {

        this._storedStringLog = new StoredStringLog({path, delimiter: `\n`});

        const contents = Number(this._storedStringLog.Entries()[0]);

        this._contents = isNaN(contents)? undefined : contents;

    }

    Contents () {

        return this._contents;

    }

    write (contents) {

        if (this._contents !== contents) {

            this._storedStringLog.overwrite(String(contents));

            this._contents = contents;

        }

    }

};
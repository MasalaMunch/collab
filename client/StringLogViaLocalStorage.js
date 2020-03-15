"use strict";

const PrefixRegExp = require(`./PrefixRegExp.js`);

const KeyAndNumberComparison = (a, b) => a[1] - b[1];

module.exports = class {

    constructor ({prefix}) {

        this._prefix = prefix;

        let i;
        const localStorageLength = localStorage.length;
        let key;
        const prefixRegExp = PrefixRegExp(this._prefix);
        const keysAndNumbers = [];
        let count = 0;
        const prefixLength = this._prefix.length;

        for (i=0; i<localStorageLength; i++) {

            key = localStorage.key(i);

            if (prefixRegExp.test(key)) {

                keysAndNumbers[count++] = [
                    key, 
                    Number(key.substring(prefixLength, key.length)),
                    ];

            }

        }

        keysAndNumbers.sort(KeyAndNumberComparison);

        const entries = keysAndNumbers;
        //^ they share the same array because they can and we want client 
        //  startup to be fast

        for (i=0; i<count; i++) {

            key = keysAndNumbers[i][0];

            entries[i] = localStorage.getItem(key);

            localStorage.removeItem(key);

        }

        this._oldEntries = entries;

        this._nextNumber = 0;

    }

    OldEntries () {

        return this._oldEntries;

    }

    deleteOldEntries () {

        this._oldEntries = undefined;

    }

    addToWriteQueue (string) {

        localStorage.set(this._prefix+String(this._nextNumber++), string);

    }

    };
"use strict";

const assert = require(`./assert.js`);
const PrefixRegExp = require(`./PrefixRegExp.js`);

module.exports = class {

    constructor ({path}) {

        this._prefix = (path[path.length-1] === `/`)? path : path+`/`;

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

        const entries = [];

        for (i=0; i<count; i++) {

            entries[i] = localStorage.getItem(keysAndNumbers[i][0]);

        }

        this._keysAndNumbers = keysAndNumbers;
        this._count = count;
        this._entries = entries;

        this._hasBeenModified = false;

    }

    Entries () {

        assert(!this._hasBeenModified);

        return this._entries;

    }

    clear () {

        assert(!this._hasBeenModified);

        const keysAndNumbers = this._keysAndNumbers;

        let i;

        for (i=this._count-1; i>=0; i--) {

            localStorage.removeItem(keysAndNumbers[i][0]);

        }

        this._keysAndNumbers = [];
        this._count = 0;
        this._entries = [];

    }

    overwrite (entry) {

        this.clear();

        this.initializeWriteQueue();

        this.addToWriteQueue(entry);

    }

    initializeWriteQueue () {

        this._keysAndNumbers = undefined;

        this._entries = undefined;

        this._hasBeenModified = true;

    }

    addToWriteQueue (entry) {

        localStorage.setItem(this._prefix+String(this._count++), entry);

    }

};
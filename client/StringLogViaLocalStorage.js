"use strict";

const {assert} = require(`@masalamunch/collab-utils`);

const PrefixRegExp = require(`./PrefixRegExp.js`);

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

        const strings = [];

        for (i=0; i<count; i++) {

            strings[i] = localStorage.getItem(keysAndNumbers[i][0]);

        }

        this._keysAndNumbers = keysAndNumbers;
        this._count = count;
        this._strings = strings;

        this._hasInitializedWriteQueue = false;

    }

    Strings () {

        assert(!this._hasInitializedWriteQueue);

        return this._strings;

    }

    clear () {

        assert(!this._hasInitializedWriteQueue);

        const keysAndNumbers = this._keysAndNumbers;

        let i;

        for (i=this._count-1; i>=0; i--) {

            localStorage.removeItem(keysAndNumbers[i][0]);

        }

        this._keysAndNumbers = [];
        this._count = 0;
        this._strings = [];

    }

    initializeWriteQueue () {

        this._keysAndNumbers = undefined;

        this._strings = undefined;

        this._hasInitializedWriteQueue = true;

    }

    addToWriteQueue (string) {

        if (!this._hasInitializedWriteQueue) {

            throw new Error(
                `addToWriteQueue was called before initializeWriteQueue`
                );

        }

        localStorage.setItem(this._prefix+String(this._count++), string);

    }

};
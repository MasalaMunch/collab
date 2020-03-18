"use strict";

const assert = require(`./assert.js`);
const AssertionError = require(`./AssertionError.js`);
const PrefixRegExp = require(`./PrefixRegExp.js`);

const firstNumber = 0;

const KeyAndNumberComparison = (a, b) => a[1] - b[1];

module.exports = class {

    static IsSupported () {

        return (
            localStorage
            && typeof localStorage.length === `number`
            && typeof localStorage.key === `function`
            && typeof localStorage.getItem === `function`
            && typeof localStorage.removeItem === `function`
            && typeof localStorage.setItem === `function`
            );

    }

    constructor ({path}) {

        assert(typeof path === `string`);
        
        this._prefix = (path[path.length-1] === `/`)? path : path+`/`;

        const sortedKeysAndNumbers = this._SortedKeysAndNumbers();

        const lastKeyAndNumber = (
            sortedKeysAndNumbers[sortedKeysAndNumbers.length-1]
            );

        this._nextNumber = (
            (lastKeyAndNumber === undefined)? 
            firstNumber : lastKeyAndNumber[1]+1
            );

    }

    _SortedKeysAndNumbers () {

        if (this._sortedKeysAndNumbers === undefined) {

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
            this._sortedKeysAndNumbers = keysAndNumbers;

        }

        return this._sortedKeysAndNumbers;

    }

    Entries () {

        if (this._entries === undefined) {

            let i;
            const sortedKeysAndNumbers = this._SortedKeysAndNumbers();
            const count = sortedKeysAndNumbers.length;
            const entries = [];

            for (i=0; i<count; i++) {

                entries[i] = localStorage.getItem(sortedKeysAndNumbers[i][0]);

            }

            this._entries = entries;

        }

        return this._entries;

    }

    clear () {

        let i;
        const keysAndNumbers = this._SortedKeysAndNumbers();

        for (i=keysAndNumbers.length-1; i>=0; i--) {

            localStorage.removeItem(keysAndNumbers[i][0]);

        }

        this._nextNumber = firstNumber; 
        //^ not necessary, but might as well do it to reduce future key lengths

        this._sortedKeysAndNumbers = [];
        this._entries = [];

    }

    addToWriteQueue (entry) {

        if (typeof entry !== `string`) {
            throw new AssertionError();
        }

        localStorage.setItem(this._prefix+String(this._nextNumber++), entry);

        this._sortedKeysAndNumbers = undefined;
        this._entries = undefined;

    }

    };
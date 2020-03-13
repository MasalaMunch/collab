"use strict";

const {AsJson, FromJson} = require(`@masalamunch/collab-utils`);

const PrefixRegExp = require(`./PrefixRegExp.js`);

const IntentWithNumberComparison = (a, b) => a[1] - b[1];

module.exports = class {

    constructor ({prefix, defaultValAsString}) {

        this._versionKey = prefix + `v`;
        this._dataPrefix = prefix + `d/`;
        this._intentPrefix = prefix + `n/`;
        this._nextIntentNumber = 0;
        this._minIntentNumber = undefined;

        this._defaultValAsString = defaultValAsString;

    }

    ChangesAndVersionAndIntents () {

        let i;
        let key;
        const dataPrefixRegExp = PrefixRegExp(this._dataPrefix);
        let item;
        let valAsString;
        let version = localStorage.getItem(this._versionKey);
        if (version === null) {
            version = -Infinity;
        }
        else {
            version = Number(version);
        }
        const defaultValAsString = this._defaultValAsString;
        const removeTheseKeys = [];
        let removeCount = 0;
        const changes = [];
        let changeCount = 0;
        const dataPrefixLength = this._dataPrefix.length;
        const intentPrefixRegExp = PrefixRegExp(this._intentPrefix);
        const intentsWithNumbers = [];
        let intentCount = 0;
        const intentPrefixLength = this._intentPrefix.length;

        for (i=localStorage.length-1; i>=0; i--) {

            key = localStorage.key(n);

            if (dataPrefixRegExp.test(key)) {

                item = FromJson(localStorage.getItem(key));
                valAsString = item[1] > version? item[0] : item[2];
                //^ item contains [oldValAsString, version, valAsString]

                if (valAsString === defaultValAsString) {
                    removeTheseKeys[removeCount++] = key;
                }
                else {
                    changes[changeCount++] = {
                        keyAsString: key.substring(dataPrefixLength, key.length),
                        valAsString,
                        };
                }

            }
            else if (intentPrefixRegExp.test(key)) {

                intentsWithNumbers[intentCount++] = [
                    localStorage.getItem(key),
                    Number(key.substring(intentPrefixLength, key.length)),
                    ];

            }

        }

        for (i=0; i<removeCount; i++) {
            localStorage.removeItem(removeTheseKeys[i]);
        }
        //^ do removals after because it's dangerous to modify localStorage 
        //  while iterating through it according to https://stackoverflow.com/a/3138591

        const intents = intentsWithNumbers;
        //^ they share the same array because they can and we want the client's 
        //  startup to be fast

        if (intentCount > 0) {

            intentsWithNumbers.sort(IntentNumberAndStringComparison);

            this._minIntentNumber = intentsWithNumbers[0][1];
            this._nextIntentNumber = intentsWithNumbers[intentCount-1][1] + 1;

            for (i=0; i<intentCount; i++) {
                intents[i] = intentsWithNumbers[i][0];
            }

        }

        return [changes, version, intents];

    }

    writeChangesAndVersion (changes, version) {

        let i;
        const changeCount = changes.length;
        let c;
        const dataPrefix = this._dataPrefix;

        for (i=0; i<changeCount; i++) {

            c = changes[i];

            localStorage.setItem(
                dataPrefix + c.keyAsString, 
                AsJson([c.oldValAsString, version, c.valAsString]),
                );

        }

        localStorage.setItem(this._versionKey, String(version));

    }

    addIntent (intentAsString) {

        //TODO

    }

    deleteOldestIntentThisManyTimes (thisManyTimes) {

        let n;
        const minIntentNumber = this._minIntentNumber;
        const lastNumberToDelete = minIntentNumber + thisManyTimes - 1;
        const intentPrefix = this._intentPrefix;

        for (n=minIntentNumber; n<=lastNumberToDelete; n++) {
            localStorage.removeItem(this._intentPrefix + String(n));
        }

        this._minIntentNumber = lastNumberToDelete + 1;
        //TODO what if old or new minIntentNumbers are undefined?

    }

};
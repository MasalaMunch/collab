"use strict";

const {assert, Collab, Queue} = require(`@masalamunch/collab-utils`);

const PrefixRegExp = require(`./PrefixRegExp,js`);
const CollabStateThatStoresVals = require(`./CollabStateThatStoresVals.js`);

const fakeStorage = {

    setItem: () => undefined,

    removeItem: () => undefined,

    };

const IntentAsStringWithNumberComparison = (a, b) => a[1] - b[1];

module.exports = class extends Collab {

    constructor (config) {

        config.CollabState = CollabStateThatStoresVals;

        super(config);

        const {localStoragePrefix} = config;

        this._serverId = 0;
        //^ i.e. undefined, since serverIds fall within [1, Infinity)

        this._currentVersion = -Infinity;

        if (localStoragePrefix === undefined) {

            this._storage = fakeStorage;

            this._versionStorageKey = undefined;

            this._syncedStoragePrefix = undefined;
            this._unsyncedStoragePrefix = undefined;

            this._minIntentStorageNumber = undefined;
            this._nextIntentStorageNumber = undefined;

        }
        else {

            this._storage = localStorage;

            assert(typeof localStoragePrefix === `string`);

            this._versionStorageKey = localStoragePrefix + `v`;
            //^ stores String(currentVersion)
            
            this._syncedStoragePrefix = localStoragePrefix + `s/`;
            //^ stores a {keyAsString -> AsJson([oldValAsString, version, 
            //  valAsString])} map
            this._unsyncedStoragePrefix = localStoragePrefix + `u/`;
            //^ stores a {String(intentStorageNumber) -> intentAsString} map

            this._minIntentStorageNumber = undefined;
            this._nextIntentStorageNumber = 0;

            const storage = this._storage;
            const storedVersion = storage.getItem(this._versionStorageKey);
            if (storedVersion !== null) {
                this._currentVersion = Number(storedVersion);
            }

            let i;
            let key;
            const syncedRegExp = PrefixRegExp(this._syncedStoragePrefix);
            let item;
            let valAsString;
            const version = this._currentVersion;
            const defaultValAsString = this._defaultValAsString;
            const removeTheseKeys = [];
            let removeCount = 0;
            const syncedPrefixLength = this._syncedStoragePrefix.length;
            const unsyncedRegExp = PrefixRegExp(this._unsyncedStoragePrefix);
            const intentsAsStringsWithNumbers = [];
            let intentCount = 0;
            const unsyncedPrefixLength = this._unsyncedStoragePrefix.length;

            for (i=storage.length-1; i>=0; i--) {

                key = storage.key(n);

                if (syncedRegExp.test(key)) {

                    item = FromJson(storage.getItem(key));
                    valAsString = item[1] > version? item[0] : item[2];

                    if (valAsString === defaultValAsString) {
                        removeTheseKeys[removeCount++] = key;
                    }
                    else {
                        this._writeChangeEventToState(
                            this._StringChangeAsChangeEvent([
                                key.substring(syncedPrefixLength, key.length), 
                                valAsString,
                                ])
                            );
                    }

                }
                else if (unsyncedRegExp.test(key)) {

                    intentsAsStringsWithNumbers[intentCount++] = [
                        storage.getItem(key),
                        Number(key.substring(unsyncedPrefixLength, key.length)),
                        ];

                }

            }

            for (i=0; i<removeCount; i++) {
                storage.removeItem(removeTheseKeys[i]);
            }
            //^ do removals after because you can't modify storage while 
            //  iterating through it, according to https://stackoverflow.com/a/3138591

            if (intentCount > 0) {

                intentsAsStringsWithNumbers.sort(
                    IntentAsStringWithNumberComparison
                    );

                this._minIntentStorageNumber = intentsAsStringsWithNumbers[0][1];
                this._nextIntentStorageNumber = (
                    intentsAsStringsWithNumbers[intentCount-1][1] + 1
                    );

                let intentAsString;
                const IntentFromString = this._IntentFromString;

                for (i=0; i<intentCount; i++) {

                    intentAsString = intentsAsStringsWithNumbers[i][0];
                    this._writeIntentAndReturnItsInfo(
                        IntentFromString(intentAsString), intentAsString, true
                        );

                }

            }

        }

    }

    _writeIntentAndReturnItsInfo (intent, intentAsString, isFromStorage) {

        const info = super._writeIntentAndReturnItsInfo(
            intent, intentAsString, isFromStorage
            );
        const changeEvents = info.changeEvents;

        //TODO write intent to in-memory buffer and storage buffer stream if not 
        //     from storage

        return info;

    }

    startSync () {



    }

    finishSync (serverOutput) {

        //TODO write all these changes atomically to storage stream

    }

    cancelSync () {



    }

};

const CollabClientClassInterface = class {

    constructor (coreConfig) {
        this._coreConfig = coreConfig;
    }

    Client (clientConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assign(config, clientConfig);
        return new CollabClient(config);
    }

};

module.exports = ClassFactory(CollabClientClassInterface);
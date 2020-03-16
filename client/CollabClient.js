"use strict";

const {assert, Collab, Queue, FakeProcessLog} 
    = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresVals = require(`./CollabStateThatStoresVals.js`);
const nonexistentCollabServerId = require(`./nonexistentCollabServerId.js`);

module.exports = class extends Collab {

    constructor (config) {

        config.CollabState = CollabStateThatStoresVals;

        super(config);

        const {localStoragePrefix} = config;

        this._serverId = nonexistentCollabServerId;

        this._currentVersion = -Infinity;

        this._unsyncedIntentsAsStrings = [];
        this._unsyncedActions = [];
        //^ used to fix the action history after these actions are synced with 
        //  the server (their changeEvents might have changed!)
        this._unsyncedChangeEvents = new Map();
        //^ a {keyAsString -> changeEvent} map that represents the difference 
        //  between the synced state and the unsynced (current) state, it's used '
        //  to revert the client to the synced state before it applies changes 
        //  from the server

        //bm


        if (localStoragePrefix === undefined) {

            this._storage = fakeStorage;

            this._versionLocalStorageKey = undefined;

            this._syncedLocalStoragePrefix = undefined;
            this._unsyncedLocalStoragePrefix = undefined;

            this._minIntentStorageNumber = undefined;
            this._nextIntentStorageNumber = undefined;

        }
        else {

            this._storage = localStorage;

            assert(typeof localStoragePrefix === `string`);

            this._versionLocalStorageKey = localStoragePrefix + `v`;
            //^ stores String(currentVersion)
            
            this._syncedLocalStoragePrefix = localStoragePrefix + `s/`;
            //^ stores a {keyAsString -> AsJson([oldValAsString, version, 
            //  valAsString])} map
            this._unsyncedLocalStoragePrefix = localStoragePrefix + `u/`;
            //^ stores a {String(intentStorageNumber) -> intentAsString} map

            this._minIntentStorageNumber = undefined;
            this._nextIntentStorageNumber = 0;

            const storage = this._storage;
            const storedVersion = storage.getItem(this._versionLocalStorageKey);
            if (storedVersion !== null) {
                this._currentVersion = Number(storedVersion);
            }

            let i;
            let key;
            const syncedRegExp = PrefixRegExp(this._syncedLocalStoragePrefix);
            let item;
            let valAsString;
            const version = this._currentVersion;
            const defaultValAsString = this._defaultValAsString;
            const removeTheseKeys = [];
            let removeCount = 0;
            const syncedPrefixLength = this._syncedLocalStoragePrefix.length;
            const unsyncedRegExp = PrefixRegExp(this._unsyncedLocalStoragePrefix);
            const intentsAsStringsWithNumbers = [];
            let intentCount = 0;
            const unsyncedPrefixLength = this._unsyncedLocalStoragePrefix.length;

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

            if (intentCount !== 0) { // if intentCount > 0

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

        const unsyncedActions = this._unsyncedActions;
        const unsyncedActionCount = unsyncedActions.length;

        unsyncedActions[unsyncedActionCount] = info.action;
        this._unsyncedIntentsAsStrings[unsyncedActionCount] = intentAsString;

        let i;
        const changeEvents = info.changeEvents;
        const changeCount = changeEvents.length;
        let e;
        let keyAsString;
        let u;
        const unsyncedChangeEvents = this._unsyncedChangeEvents;

        for (i=0; i<changeCount; i++) {

            e = changeEvents[i];
            keyAsString = e.keyAsString;
            u = unsyncedChangeEvents.get(keyAsString);

            if (u === undefined) {

                unsyncedChangeEvents.set(keyAsString, Object.assign({}, e));

            }
            else {

                u.val = e.val;
                u.valAsString = e.valAsString;

            }


        }

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
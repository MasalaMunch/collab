"use strict";

const JoinedPaths = require(`path`).join;

const {assert, Collab, FakeValue, jsonSeparator, EmptyLog, StoredStringLog} 
    = require(`@masalamunch/collab-utils`);

const nonexistentServerId = require(`./nonexistentServerId.js`);

module.exports = class extends Collab {

    constructor (config) {

        super(config);

        const {storagePath} = config;

        if (storagePath === undefined) {

            this._serverOutputAsJsonStorage = new StoredStringLog({
                path: JoinedPaths(storagePath, `s`),
                separator: jsonSeparator,
                });
            this._intentEventAsJsonStorage = new StoredStringLog({
                path: JoinedPaths(storagePath, `i`),
                separator: jsonSeparator,
                });

        }
        else {

            this._serverOutputAsJsonStorage = new EmptyLog();
            this._intentEventAsJsonStorage = new EmptyLog();

        }

        this._serverId = nonexistentServerId;

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

    }

    _writeIntentAndReturnItsInfo (intent, isFromStorage) {

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
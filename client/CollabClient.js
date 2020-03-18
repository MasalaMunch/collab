"use strict";

const JoinedPaths = require(`path`).join;

const {Collab, jsonSeparator, EmptyLog, StoredStringLog, firstVersion} 
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
            this._actionEventAsJsonStorage = new StoredStringLog({
                path: JoinedPaths(storagePath, `i`),
                separator: jsonSeparator,
                });

        }
        else {

            this._serverOutputAsJsonStorage = new EmptyLog();
            this._actionEventAsJsonStorage = new EmptyLog();

        }

        let i;
        const serverOutputAsJsonStorage = this._serverOutputAsJsonStorage;
        const serverOutputAsJsonArray = serverOutputAsJsonStorage.Entries();
        const serverOutputCount = serverOutputAsJsonArray.length;
        let serverOutput;
        let serverId = nonexistentServerId;
        let changesFromJsonArray = [];
        let changesCount = 0;
        let currentVersion = firstVersion;
        let intentChangesAsJsonArray;
        let intentCount;
        let j;

        for (i=0; i<serverOutputCount; i++) {

            serverOutput = FromJson(serverOutputAsJsonArray[i]);
            //^ contains [serverId, version, intentChangesAsJsonArray, newChanges]

            if (serverId !== serverOutput[0]) {

                serverId = serverOutput[0];

                changesFromJsonArray = [];
                changesCount = 0;

            }

            currentVersion = serverOutput[1];

            changesFromJsonArray[changesCount++] = serverOutput[3];

            intentChangesAsJsonArray = serverOutput[2];
            intentCount = intentChangesAsJsonArray.length;

            for (j=0; j<intentCount; j++) {

                changesFromJsonArray[changesCount++] = (
                    FromJson(intentChangesAsJsonArray[j])
                    );

            }

        }

        this._serverId = serverId;
        this._currentVersion = currentVersion;

        const {partialChangeEvents, changes} = (
            Collab._CompressedChangesFromJsonArray(changesFromJsonArray)
            );

        this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);
        
        serverOutputAsJsonStorage.clear();
        serverOutputAsJsonStorage.addToWriteQueue(
            AsJson([serverId, currentVersion, [], changes])
            );

        this._unsyncedChangeEvents = new Map();
        //^ a {keyAsString -> changeEvent} map that represents the difference 
        //  between the synced state and the unsynced (current) state, it's used '
        //  to revert the client to the synced state before it applies changes 
        //  from the server
        this._unsyncedActions = [];
        //^ used to fix the action history after these actions are synced with 
        //  the server (their changeEvents might have changed!)
        this._unsyncedIntents = [];

        //TODO read action event entries

    }

    _writeIntentAndReturnItsInfo (intent, intentAsJson, isFromStorage) {

        const info = super._writeIntentAndReturnItsInfo(
            intent, intentAsJson, isFromStorage
            );

        this._actionEventAsJsonStorage.addToWriteQueue(AsJson([intentAsJson]));

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

                u = {};
                Object.assign(u, e);
                unsyncedChangeEvents.set(keyAsString, u);

            }
            else {

                u.val = e.val;
                u.valAsString = e.valAsString;

            }

        }

        const unsyncedActions = this._unsyncedActions;
        const unsyncedActionCount = unsyncedActions.length;

        unsyncedActions[unsyncedActionCount] = info.action;
        this._unsyncedIntents[unsyncedActionCount] = intent;

        return info;

    }

    startSync () {



    }

    finishSync (serverOutput) {



    }

    cancelSync () {



    }

    };
"use strict";

const JoinedPaths = require(`path`).join;

const {Collab, jsonSeparator, EmptyJsoLog, StoredJsoLog, 
       CompressedChangesArray} = require(`@masalamunch/collab-utils`);

const nonexistentServerId = require(`./nonexistentServerId.js`);
const Queue = require(`./Queue.js`);

module.exports = class extends Collab {

    constructor (config) {

        super(config);

        const {storagePath} = config;

        if (storagePath === undefined) {

            this._serverOutputStorage = new StoredJsoLog({
                path: JoinedPaths(storagePath, `s`),
                });
            this._intentEventStorage = new StoredJsoLog({
                path: JoinedPaths(storagePath, `i`),
                });

        }
        else {

            this._serverOutputStorage = new EmptyJsoLog();
            this._intentEventStorage = new EmptyJsoLog();

        }

        this._serverId = nonexistentServerId;

        this._unsyncedChangeEvents = new Map();
        //^ a {keyAsString -> changeEvent} map that represents the difference 
        //  between the synced state and the unsynced (current) state, it's used '
        //  to revert the client to the synced state before it applies changes 
        //  from the server
        this._unsyncedActions = [];
        //^ used to fix the action history after these actions are synced with 
        //  the server (their changeEvents might have changed!)
        this._unsyncedIntents = [];

        this._loadServerOutputStorage();
        this._loadIntentEventStorage();

    }

    _loadServerOutputStorage () {

        let i;
        const serverOutputStorage = this._serverOutputStorage;
        const serverOutputArray = serverOutputStorage.Entries();
        const serverOutputCount = serverOutputArray.length;
        let serverOutput;
        let serverId = this._serverId;
        let currentVersion = this._currentVersion;
        let changesArray = [];
        let changesCount = 0;
        let intentChangesAsJsonArray;
        let intentCount;
        let j;

        for (i=0; i<serverOutputCount; i++) {

            serverOutput = serverOutputArray[i];
            //^ contains [serverId, version, intentChangesAsJsonArray, newChanges]

            if (serverId !== serverOutput[0]) {

                serverId = serverOutput[0];

                changesArray = [];
                changesCount = 0;

            }

            //TODO what if client input was rejected?

            currentVersion = serverOutput[1];

            changesArray[changesCount++] = serverOutput[3];

            intentChangesAsJsonArray = serverOutput[2];
            intentCount = intentChangesAsJsonArray.length;

            for (j=0; j<intentCount; j++) {

                changesArray[changesCount++] = (
                    JsoFromJson(intentChangesAsJsonArray[j])
                    );

            }

        }

        this._serverId = serverId;
        this._currentVersion = currentVersion;

        const {partialChangeEvents, changes} = (
            CompressedChangesArray(changesArray)
            );

        this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);
        
        serverOutputStorage.clear();
        serverOutputStorage.addJsonToWriteQueue(JsoAsJson(
            [serverId, currentVersion, [], changes]
            ));

    }

    _loadIntentEventStorage () {

        const intentEventStorage = this._intentEventStorage;
        const intentEvents = intentEventStorage.Entries();
        const intentEventCount = intentEvents.length;
        let e;
        const intentQueue = new Queue();
        intentCount = 0;

        for (i=0; i<intentEventCount; i++) {

            e = intentEvents[i];

            if (typeof e === `number`) {

                for (j=0; j<e; j++) {

                    intentQueue.deleteOldestItem();

                }

                intentCount -= e;

            }
            else { // e contains [intent]

                intentQueue.add(e[0]);

                intentCount++;

            }

        }

        intentEventStorage.clear();

        for (i=0; i<intentCount; i++) {

            this._writeIntentAndReturnItsInfo(intentQueue.OldestItem());
            intentQueue.deleteOldestItem();

        }

    }

    _writeIntentAndReturnItsInfo (intent) {

        const info = super._writeIntentAndReturnItsInfo(intent);

        this._intentEventStorage.addJsonToWriteQueue(JsoAsJson([intent]));

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
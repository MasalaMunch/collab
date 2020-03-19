"use strict";

const JoinedPaths = require(`path`).join;

const {assert, AssertionError, Collab, EmptyJsoLog, StoredJsoLog, JsoAsJson, JsoFromJson,
       CompressedChangesArray, doNothing, firstVersion, JsoFromString, JsoAsString, defaultValAsString, defaultVal} = require(`@masalamunch/collab-utils`);

const nonexistentServerId = require(`./nonexistentServerId.js`);
const Queue = require(`./Queue.js`);

module.exports = class extends Collab {

    constructor (config) {

        super(config);

        const {storagePath, handleServerChange} = config;

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

        if (handleServerChange === undefined) {
            handleServerChange = doNothing;
        }

        assert(typeof handleServerChange === `function`);
        this._handleServerChange = handleServerChange;

        this._serverId = nonexistentServerId;

        this._isSyncing = false;

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
        let intentChanges;

        for (i=0; i<serverOutputCount; i++) {

            serverOutput = serverOutputArray[i];
            //^ contains [serverId, version, intentChangesAsJsonArray, newChanges]

            if (serverId !== serverOutput[0]) {

                serverId = serverOutput[0];

                changesArray = [];
                changesCount = 0;

            }

            currentVersion = serverOutput[1];

            changesArray[changesCount++] = serverOutput[3];

            intentChangesAsJsonArray = serverOutput[2];
            intentCount = intentChangesAsJsonArray.length;

            for (j=0; j<intentCount; j++) {

                intentChanges = JsoFromJson(intentChangesAsJsonArray[j]);

                if (intentChanges !== 0) { // i.e. not rejected by server

                    changesArray[changesCount++] = intentChanges;

                }

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

        if (this._isSyncing) {
            throw new AssertionError();
        }
        this._isSyncing = true;
        return JsoAsJson(
            [this._serverId, this._currentVersion, this._unsyncedIntents]
            );

    }

    cancelSync () {

        if (!this._isSyncing) {
            throw new AssertionError();
        }
        this._isSyncing = false;

    }

    finishSync (serverOutputAsJson) {

        if (!this._isSyncing) {
            throw new AssertionError();
        }
        this._isSyncing = false;

        const serverOutput = JsoFromJson(serverOutputAsJson);
        //^ contains [id, version, intentChangesAsJsonArray, newChanges, 
        //            inputWasRejected]

        if (serverOutput[4] === 1) { // if input was rejected
            throw new AssertionError();
        }

        const intentChangesAsJsonArray = serverOutput[2];
        const intentCount = intentChangesAsJsonArray.length;

        this._intentEventStorage.addJsonToWriteQueue(JsoAsJson(intentCount));
        this._serverOutputStorage.addJsonToWriteQueue(serverOutputAsJson);

        const id = serverOutput[0];

        if (this._serverId !== id && this._serverId !== nonexistentServerId) {

            this._handleServerChange();

            const partialChangeEvents = [];
            let changeCount = 0;

            for (const keyAsString of this._stateMap.keys()) {

                partialChangeEvents[changeCount] = {
                    keyAsString,
                    key: JsoFromString(keyAsString),
                    valAsString: defaultValAsString,
                    val: defaultVal,
                    };

            }

            this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);

        }
        else {

            let oldVal;
            let oldValAsString;

            for (const e of this._unsyncedChangeEvents.values()) {

                oldVal = e.oldVal;
                oldValAsString = e.oldValAsString;

                e.oldVal = e.val;
                e.oldValAsString = e.valAsString;

                e.val = oldVal;
                e.valAsString = oldValAsString;

                //^ reverse the change

                this._writeChangeEventToState(e); 

            }

        }

        this._unsyncedChangeEvents = new Map();

        this._serverId = id;
        this._currentVersion = serverOutput[1];

        let i;
        let intentChanges;
        const intentChangesArray = intentChangesAsJsonArray;
        const unsyncedIntents = this._unsyncedIntents;
        const changesArray = [serverOutput[3]];
        let changesCount = 1;

        for (i=0; i<intentCount; i++) {

            intentChanges = JsoFromJson(intentChangesAsJsonArray[i]);
            intentChangesArray[i] = intentChanges;
            if (intentChanges === 0) { // if intent was rejected
                console.log(`an intent was rejected:`, unsyncedIntents[i]);
            }
            else {
                changesArray[changesCount++] = intentChanges;
            }

        }

        let changes;
        let cCount;
        let partialChangeEvents;
        let j;
        let c;
        let key;
        let val;

        for (i=0; i<changesCount; i++) {

            changes = changesArray[i];
            cCount = changes.length;
            partialChangeEvents = changes;

            for (j=0; j<cCount; j++) {

                c = changes[j];
                key = c[0];
                val = c[1];

                partialChangeEvents[j] = {
                    key,
                    val,
                    keyAsString: JsoAsString(key),
                    valAsString: JsoAsString(val),
                    };

            }

            this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);

        }

        const intentChangeEventsArray = intentChangesArray;
        //^ changes have been replaced with partialChangeEvents and normalized

        const actionChangeEvents = this._actionChangeEvents;
        const unsyncedActions = this._unsyncedActions;

        for (i=0; i<intentCount; i++) {
            actionChangeEvents.set(unsyncedActions[i], intentChangeEventsArray[i]);
        }

        this._unsyncedActions = unsyncedActions.slice(intentCount);
        this._unsyncedIntents = unsyncedIntents.slice(intentCount);

    }

    };
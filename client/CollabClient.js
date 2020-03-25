"use strict";

const JoinedPaths = require(`path`).join;

const {AsJson, assert, AssertionError, Collab, EmptyLog, StoredStringLog, 
       jsonSeparator, MergedObjects, nonexistentServerId, defaultValAsString, doNothing, firstVersion, 
       FromJson, FromString, IsFromRejectBadInput} = require(`@masalamunch/collab-utils`);

const defaultConfig = {

    handleServerChange: doNothing,

    };

module.exports = class extends Collab {

    constructor (config) {

        config = MergedObjects(defaultConfig, config);

        super(config);

        const {storagePath, handleServerChange} = config;

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

        assert(typeof handleServerChange === `function`);
        this._handleServerChange = handleServerChange;

        this._serverId = nonexistentServerId;

        this._currentVersion = 0; // i.e. undefined

        this._isSyncing = false;

        this._unsyncedActions = [];
        //^ used to fix the action history after these actions are synced with 
        //  the server (their changeEvents might have changed)
        this._keyAsStringSyncedValsAsStrings = new Map();        
        //^  represent the difference between the synced state and the unsynced 
        //   (current) state, used to rewind the client to the synced state 
        //   before it applies changes from the server
        this._unsyncedIntentsAsStrings = [];

        this._loadServerOutputStorage();
        this._loadIntentEventStorage();

    }

    IsSyncing () {

        return this._isSyncing;

    }

    IsSynced () {

        return (this._unsyncedIntentsAsStrings.length === 0);

    }

    _loadServerOutputStorage () {

        let i;
        const serverOutputAsJsonStorage = this._serverOutputAsJsonStorage;
        const serverOutputAsJsonArray = serverOutputAsJsonStorage.Entries();
        const serverOutputCount = serverOutputAsJsonArray.length;
        let serverOutput;
        let serverId = this._serverId;
        let currentVersion = this._currentVersion;
        let stringChangesArray = [];
        let intentStringChangesAsJsonArray;
        let intentCount;
        let j;
        let intentStringChanges;

        for (i=0; i<serverOutputCount; i++) {

            serverOutput = FromJson(serverOutputAsJsonArray[i]);
            //^ contains [serverId, version, intentStringChangesAsJsonArray, 
            //            newStringChanges]

            currentVersion = serverOutput[1];

            if (serverId !== serverOutput[0]) {

                serverId = serverOutput[0];

                stringChangesArray = [];

            }

            if (serverOutput[3] !== 0) { // if not undefined

                stringChangesArray.push(serverOutput[3]);

            }

            intentStringChangesAsJsonArray = serverOutput[2];
            intentCount = intentStringChangesAsJsonArray.length;

            for (j=0; j<intentCount; j++) {

                intentStringChanges = FromJson(intentStringChangesAsJsonArray[j]);

                if (intentStringChanges !== 0) { // if not undefined

                    stringChangesArray.push(intentStringChanges);

                }

            }

        }

        this._currentVersion = currentVersion;
        this._serverId = serverId;

        const {partialChangeEvents, stringChanges} = 
            this._CompressedStringChangesArray(stringChangesArray);

        this._fillPartialChangeEventsAndWriteThemToState(partialChangeEvents);
        
        serverOutputAsJsonStorage.clear();
        serverOutputAsJsonStorage.addToWriteQueue(AsJson(
            [serverId, currentVersion, 0, stringChanges]
            ));

    }

    _loadIntentEventStorage () {

        let i;
        const intentEventAsJsonStorage = this._intentEventAsJsonStorage;
        const intentEventsAsJson = intentEventAsJsonStorage.Entries();
        const intentEventCount = intentEventsAsJson.length;
        let e;
        const intentsAsStrings = new Array(intentEventCount);
        let addedIntentCount = 0;
        let removedIntentCount = 0;

        for (i=0; i<intentEventCount; i++) {

            e = FromJson(intentEventsAsJson[i]);

            if (typeof e === `number`) {

                removedIntentCount += e;

            }
            else { // e contains [intentAsString]

                intentsAsStrings[addedIntentCount++] = e[0];

            }

        }

        let s;
        let intent;

        intentEventAsJsonStorage.clear();

        for (i=removedIntentCount; i<addedIntentCount; i++) {

            s = intentsAsStrings[i];
            intent = FromString(s);

            try {

                this._writeIntent(intent, s);

            } catch (error) {

                if (!IsFromRejectBadInput(error)) {

                    throw error;

                }

            }

        }

    }

    _writeIntent (intent, intentAsString) {

        const info = super._writeIntent(intent, intentAsString);

        this._intentEventAsJsonStorage.addToWriteQueue(AsJson([intentAsString]));

        let i;
        const changeEvents = info.changeEvents;
        const changeCount = changeEvents.length;
        let e;
        let keyAsString;
        const keyAsStringSyncedValsAsStrings = this._keyAsStringSyncedValsAsStrings;        

        for (i=0; i<changeCount; i++) {

            e = changeEvents[i];

            keyAsString = e.keyAsString;

            if (!keyAsStringSyncedValsAsStrings.has(keyAsString)) {

                keyAsStringSyncedValsAsStrings.set(keyAsString, e.oldValAsString);                

            }

        }

        this._unsyncedActions.push(info.action);
        this._unsyncedIntentsAsStrings.push(intentAsString);

        return info;

    }

    startSync () {

        if (this._isSyncing) {
            throw new AssertionError();
        }

        this._isSyncing = true;

        let intentsAsStrings = this._unsyncedIntentsAsStrings;

        if (intentsAsStrings.length === 0) {

            intentsAsStrings = 0; // i.e. undefined

        }

        return AsJson(
            [this._serverId, this._currentVersion, intentsAsStrings]
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

        const [id, version, intentStringChangesAsJsonArray, newStringChanges] = 
            FromJson(serverOutputAsJson);

        if (newStringChanges === 0 && intentStringChangesAsJsonArray === 0
        && id === nonexistentServerId) {

            return;
            //^ speeds up the common case and makes serverOutputAsJsonStorage
            //  more compact    

        }

        this._serverOutputAsJsonStorage.addToWriteQueue(serverOutputAsJson);

        let intentCount = intentStringChangesAsJsonArray.length;

        if (intentCount === undefined) {

            intentCount = 0;

        }
        else {

            this._intentEventAsJsonStorage.addToWriteQueue(AsJson(intentCount));
            //^ tell storage how many intents were sucessfully sent to server

        }

        this._currentVersion = version;

        let rewindStringChanges;

        if (id === nonexistentServerId) {

            let c;
            const keyAsStringSyncedValsAsStrings = 
                this._keyAsStringSyncedValsAsStrings;
            rewindStringChanges = 
                new Array(keyAsStringSyncedValsAsStrings.size);
            let i = 0;

            for (c of keyAsStringSyncedValsAsStrings) {

                rewindStringChanges[i++] = c;

            }

        }
        else {

            if (this._serverId !== nonexistentServerId) {

                this._handleServerChange();

            }

            this._serverId = id;

            let keyAsString;
            const keyAsStringVals = this._keyAsStringVals;
            rewindStringChanges = new Array(keyAsStringVals.size);
            let i = 0;

            for (keyAsString of keyAsStringVals.keys()) {

                rewindStringChanges[i++] = [keyAsString, defaultValAsString];

            }

        }

        this._keyAsStringSyncedValsAsStrings = new Map();

        let i;
        let intentStringChanges;
        const intentStringChangesArray = intentStringChangesAsJsonArray;
        const changesCount = 2 + intentCount;
        const stringChangesArray = new Array(changesCount);
        stringChangesArray[0] = rewindStringChanges;
        stringChangesArray[1] = newStringChanges;

        for (i=0; i<intentCount; i++) {

            intentStringChanges = FromJson(intentStringChangesAsJsonArray[i]);
            intentStringChangesArray[i] = intentStringChanges;
            stringChangesArray[2 + i] = intentStringChanges;

        }

        let stringChanges;
        let cCount;
        let partialChangeEvents;
        let j;
        let c;
        let keyAsString;
        let valAsString;

        for (i=0; i<changesCount; i++) {

            stringChanges = stringChangesArray[i];

            if (stringChanges !== 0) { // if not undefined

                cCount = stringChanges.length;
                partialChangeEvents = stringChanges;

                for (j=0; j<cCount; j++) {

                    c = stringChanges[j];

                    keyAsString = c[0];
                    valAsString = c[1];

                    partialChangeEvents[j] = {

                        keyAsString,
                        valAsString,

                        key: FromString(keyAsString),
                        val: FromString(valAsString),

                        };

                }

                this._fillPartialChangeEventsAndWriteThemToState(partialChangeEvents);

            }

        }

        const actionChangeEvents = this._actionChangeEvents;
        const unsyncedActions = this._unsyncedActions;
        const intentChangeEventsArray = intentStringChangesArray;
        //^ stringChanges have been replaced with partialChangeEvents and filled

        for (i=0; i<intentCount; i++) {
            actionChangeEvents.set(unsyncedActions[i], intentChangeEventsArray[i]);
        }

        this._unsyncedActions = unsyncedActions.slice(intentCount);
        this._unsyncedIntentsAsStrings = unsyncedIntentsAsStrings.slice(intentCount);

    }

    };
"use strict";

const JoinedPaths = require(`path`).join;

const RbTree = require(`bintrees`).RBTree;

const {assert, MergedObjects, nonexistentServerId, Collab, defaultValAsString, 
       rejectBadInput, AsJson, FromJson, FromString, EmptyLog, 
       StoredStringLog, AssertionError, firstVersion, jsonSeparator, 
       IsFromRejectBadInput} = require(`@masalamunch/collab-utils`);

const NewServerId = require(`./NewServerId.js`);

const firstVersion = 0;

const VersionComparison = (a, b) => a - b;

const defaultConfig = {

    handleClientInputRejection: (reason) => {
        console.log({event: `clientInputRejection`, reason});
    },

    };

module.exports = class extends Collab {

    constructor (config) {

        config = MergedObjects(defaultConfig, config);

        super(config);

        const {storagePath, handleClientInputRejection} = config;

        if (storagePath === undefined) {

            this._stringChangesAsJsonStorage = new EmptyLog();

        }
        else {

            this._stringChangesAsJsonStorage = new StoredStringLog({
                path: JoinedPaths(storagePath, `c`),
                separator: jsonSeparator,
                });

        }

        assert(typeof handleClientInputRejection === `function`);
        this._handleClientInputRejection = handleClientInputRejection;

        this._id = NewServerId();

        this._keyAsStringVersions = new Map();
        this._versionKeysAsStrings = new Map();

        this._currentVersion = firstVersion;

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._loadStringChangesAsJsonStorage();

    }

    _loadStringChangesAsJsonStorage () {

        let i;
        const stringChangesAsJsonStorage = this._stringChangesAsJsonStorage;
        const stringChangesAsJsonArray = stringChangesAsJsonStorage.Entries();
        const changesCount = stringChangesAsJsonArray.length;
        const stringChangesArray = stringChangesAsJsonArray;

        for (i=0; i<changesCount; i++) {
            stringChangesArray[i] = FromJson(stringChangesAsJsonArray[i]);
        }

        const {partialChangeEvents, stringChanges} = 
            this._CompressedStringChangesArray(stringChangesArray);

        this._fillPartialChangeEventsAndWriteThemToState(partialChangeEvents);
        
        stringChangesAsJsonStorage.clear();
        stringChangesAsJsonStorage.addToWriteQueue(AsJson(stringChanges));

    }

    _VersionTreeStringChangesSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return 0; // i.e. undefined, speeds up the common case
        }

        let keyAsString;
        const versionKeysAsStrings = this._versionKeysAsStrings;
        let valAsString;
        const keyAsStringValsAsStrings = this._keyAsStringValsAsStrings;
        const stringChanges = [];

        version = iterator.data();

        do {

            keyAsString = versionKeysAsStrings.get(version);

            valAsString = keyAsStringValsAsStrings.get(keyAsString);

            if (valAsString === undefined) {
                valAsString = defaultValAsString;
            }

            stringChanges.push([keyAsString, valAsString]);

        } while ((version = iterator.next()) !== null);

        return stringChanges;

    }

    _writeIntent (intent, intentAsString) {

        const info = super._writeIntent(intent, intentAsString);

        let i;
        const changeEvents = info.changeEvents;
        const changeCount = changeEvents.length;
        let e;
        const stringChanges = new Array(changeCount);

        for (i=0; i<changeCount; i++) {

            e = changeEvents[i];
            stringChanges[i] = [e.keyAsString, e.valAsString];

        }

        const stringChangesAsJson = AsJson(stringChanges);

        this._stringChangesAsJsonStorage.addToWriteQueue(stringChangesAsJson);

        info.stringChangesAsJson = stringChangesAsJson;

        return info;

    }

    sync (clientInputAsJson) {

        let id = nonexistentServerId;
        let newStringChanges = 0; // i.e. undefined
        let intentStringChangesAsJsonArray = 0; // i.e. undefined
        let inputWasSuccessfullyParsed = 1; // i.e. true

        try {

            let clientInput;
            try {
                clientInput = FromJson(clientInputAsJson);
                //^ should contain [id, version, intentsAsStrings]
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (clientInput === null) {
                rejectBadInput(new AssertionError());
            }

            let version;

            if (clientInput[0] === this._id) {

                version = clientInput[1];

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._deletionVersionTree, version
                    );

            }
            else {

                id = this._id;

                version = firstVersion;

            }

            if (newStringChanges === 0) { // i.e. undefined

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, version
                    );

            }
            else {

                let i;
                const moreStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, version
                    );

                for (i=moreStringChanges.length-1; i>=0; i--) {
                //^ reverse iteration is fine since trees don't contain 
                //  overwritten changes

                    newStringChanges.push(moreStringChanges[i]);

                }

            }

            //^ get the changes that've happened since the client last synced

            if (clientInput[2] !== 0) { // i.e. undefined

                let i;
                const intentsAsStrings = clientInput[2];
                let intentCount;
                try {
                    intentCount = intentsAsStrings.length;
                }
                catch (error) {
                    rejectBadInput(error);
                }
                let s;
                let n;
                intentStringChangesAsJsonArray = intentsAsStrings; 
                const handleClientInputRejection = this._handleClientInputRejection;

                for (i=0; i<intentCount; i++) {

                    s = intentsAsStrings[i];
                    if (typeof s !== `string`) {
                        rejectBadInput(new AssertionError());
                    }
                    try {
                        n = FromString(s);
                    }
                    catch (error) {
                        rejectBadInput(error);
                    }

                    try {

                        intentStringChangesAsJsonArray[i] =
                            this._writeIntent(n, s).stringChangesAsJson;

                    }
                    catch (error) {

                        if (IsFromRejectBadInput(error)) {

                            intentStringChangesAsJsonArray[i] = 0; 
                            //^ i.e. rejected
                            handleClientInputRejection(error.reason);

                        }
                        else {

                            throw error;

                        }

                    }

                }

            }

            //^ add the changes resulting from the client's intents

        }
        catch (error) {

            if (IsFromRejectBadInput(error)) {

                inputWasSuccessfullyParsed = 0; // i.e. false
                this._handleClientInputRejection(error.reason);

            }
            else {

                throw error;

            }

        }

        return AsJson(
            [id, this._currentVersion, intentStringChangesAsJsonArray, 
             newStringChanges, inputWasSuccessfullyParsed]
            );

    }

    _writeChangeEventToState (changeEvent) {

        super._writeChangeEventToState(changeEvent);

        const keyAsStringVersions = this._keyAsStringVersions;
        const keyAsString = changeEvent.keyAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);
        const versionKeysAsStrings = this._versionKeysAsStrings;

        if (oldVersion !== undefined) {

            versionKeysAsStrings.delete(oldVersion);

            if (changeEvent.oldValAsString === defaultValAsString) {

                this._deletionVersionTree.remove(oldVersion);

            }
            else {

                this._versionTree.remove(oldVersion);

            }

        }

        const newVersion = ++this._currentVersion;

        keyAsStringVersions.set(keyAsString, newVersion);
        versionKeysAsStrings.set(newVersion, keyAsString);

        if (changeEvent.valAsString === defaultValAsString) {

            this._deletionVersionTree.insert(newVersion);

        }
        else {

            this._versionTree.insert(newVersion);

        }

    }

    };
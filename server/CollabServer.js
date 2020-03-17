"use strict";

const JoinedPaths = require(`path`).join;

const RbTree = require(`bintrees`).RBTree;

const {assert, Collab, rejectBadInput, AsJson, FromJson, EmptyLog, 
       StoredStringLog, jsonSeparator} = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresValsAsStrings 
    = require(`./CollabStateThatStoresValsAsStrings.js`);
const NewCollabServerIdViaMathDotRandom 
    = require(`./NewCollabServerIdViaMathDotRandom.js`);
const NewCollabServerIdViaStorage
    = require(`./NewCollabServerIdViaStorage.js`);

const VersionComparison = (a, b) => a - b;

const firstVersion = 0;

module.exports = class extends Collab {

    constructor (config) {

        config.CollabState = CollabStateThatStoresValsAsStrings;

        super(config);

        const {storagePath} = config;

        if (storagePath === undefined) {

            this._stringChangesAsJsonStorage = new EmptyLog();
            this._id = NewCollabServerIdViaMathDotRandom();

        }
        else {

            this._stringChangesAsJsonStorage = new StoredStringLog({
                path: JoinedPaths(storagePath, `l`),
                separator: jsonSeparator,
                });
            this._id = NewCollabServerIdViaStorage({
                path: JoinedPaths(storagePath, `i`),
                });

        }

        this._keyAsStringVersions = new Map();
        this._versionKeysAsStrings = new Map();

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._currentVersion = firstVersion;

        const stringChangesAsJsonStorage = this._stringChangesAsJsonStorage;

        let i;
        const stringChangesAsJsonArray = stringChangesAsJsonStorage.Entries();
        const changesCount = stringChangesAsJsonArray.length;
        const stringChangesArray = [];

        for (i=0; i<changeCount; i++) {

            stringChangesArray[i] = FromJson(stringChangesAsJsonArray[i]);

        }

        const compressedStringChanges = (
            this._CompressedStringChanges(stringChangesArray)
            );

        this._writeStringChangesToState(compressedStringChanges);
        
        stringChangesAsJsonStorage.clear();
        stringChangesAsJsonStorage.initializeWriteQueue();
        stringChangesAsJsonStorage.addToWriteQueue(AsJson(compressedStringChanges));

    }

    *_VersionTreeStringChangesSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return 0; // i.e. undefined, speeds up the common case
        }

        const stringChanges = [];
        let changeCount = 0;

        const versionKeysAsStrings = this._versionKeysAsStrings;
        const state = this.state;

        let version = iterator.data();
        let keyAsString;

        do {

            keyAsString = versionKeysAsStrings.get(version);
            stringChanges[changeCount++] = [
                keyAsString, 
                state.ValAsStringOfKeyAsString(keyAsString),
                ];

        } while ((version = iterator.next()) !== null);

        return stringChanges;

    }

    _writeIntentAndReturnItsInfo (intent, intentAsString, isFromStorage) {

        const info = super._writeIntentAndReturnItsInfo(
            intent, intentAsString, isFromStorage
            );

        let i;
        const changeEvents = info.changeEvents;
        const changeCount = changeEvents.length;
        let e;
        const stringChanges = [];

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

        const id = this._id;
        let newStringChanges = 0; // i.e. undefined
        let intentStringChangesAsJsonArray = 0; // i.e. undefined
        let rejectedInput = 0; // i.e. false

        try {

            let clientInput;
            try {
                clientInput = FromJson(clientInputAsJson);
                //^ should contain [serverId, version, intentsAsStrings]
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (clientInput === null) {
                rejectBadInput(new TypeError(`client input is null`));
            }
            let version;

            if (clientInput[0] === id) {

                version = clientInput[1];

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._deletionVersionTree, 
                    version,
                    );

            }
            else {

                version = firstVersion;

            }

            if (newStringChanges === 0) { // i.e. undefined

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, 
                    version,
                    );

            }
            else {

                let i;
                const moreStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, 
                    version,
                    );
                let changeCount = newStringChanges.length;

                for (i=moreStringChanges.length-1; i>=0; i--) {
                //^ reverse iteration is fine since trees don't contain 
                //  overwritten changes

                    newStringChanges[changeCount++] = moreStringChanges[i];

                }

            }

            //^ get the changes that've happened since the client last synced

            if (clientInput[2] !== 0) { // i.e. undefined

                let i;
                const intentsAsStrings = clientInput[2];
                let intentCount;
                try {
                    intentCount = intentsAsStrings.length;
                } catch (error) {
                    rejectBadInput(error);
                }
                let s;
                let n;
                const IntentFromString = this._IntentFromString;
                let changes;
                let changeCount;
                let stringChanges;
                let j;
                let c;
                intentStringChangesAsJsonArray = intentsAsStrings; 
                //^ they share the same array because they can and we want  
                //  server sync to be fast

                for (i=0; i<intentCount; i++) {

                    s = intentsAsStrings[i];
                    if (typeof s !== `string`) {
                        rejectBadInput(new TypeError(
                            `a non-string item was found in intentsAsStrings`
                            ));
                    }
                    try {
                        n = IntentFromString(s);
                    } catch (error) {
                        rejectBadInput(error);
                    }
                    intentStringChangesAsJsonArray[i] = (
                        this._writeIntentAndReturnItsInfo(n, s, false)
                        .stringChangesAsJson
                        );

                }

            }

            //^ add the changes resulting from the client's intents

        } catch (error) {

            if (error.rejectedBadInput === true 
            && error.hasOwnProperty(`reason`)) {

                rejectedInput = 1; // i.e. true
                console.log(error);

            }
            else {

                throw error;

            }

        }

        return AsJson(
            [id, this._currentVersion, intentStringChangesAsJsonArray, 
             newStringChanges, rejectedInput]
            );

    }

    _writeChangeEventToState (changeEvent) {

        super._writeChangeEventToState(changeEvent);

        const keyAsString = changeEvent.keyAsString;
        const keyAsStringVersions = keyAsStringVersions;
        const versionKeysAsStrings = this._versionKeysAsStrings;
        const defaultValAsString = defaultValAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);

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
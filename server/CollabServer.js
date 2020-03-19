"use strict";

const JoinedPaths = require(`path`).join;

const RbTree = require(`bintrees`).RBTree;

const {Collab, rejectBadInput, JsoAsJson, JsoFromJson, EmptyJsoLog, StoredJsoLog, 
       AssertionError, defaultVal, defaultValAsString, firstVersion, 
       CompressedChangesArray} = require(`@masalamunch/collab-utils`);

const NewServerId = require(`./NewServerId.js`);

const VersionComparison = (a, b) => a - b;

module.exports = class extends Collab {

    constructor (config) {

        super(config);

        const {storagePath} = config;

        if (storagePath === undefined) {

            this._changesStorage = new EmptyJsoLog();

        }
        else {

            this._changesStorage = new StoredJsoLog({
                path: JoinedPaths(storagePath, `c`),
                });

        }

        this._id = NewServerId();

        this._keyAsStringVersions = new Map();
        
        this._versionKeys = new Map();
        this._versionKeysAsStrings = new Map();

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._loadChangesStorage();

    }

    _loadChangesStorage () {

        const changesStorage = this._changesStorage;

        const {partialChangeEvents, changes} = (
            CompressedChangesArray(changesStorage.Entries())
            );

        this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);
        
        changesStorage.clear();
        changesStorage.addJsonToWriteQueue(JsoAsJson(changes));

    }

    *_VersionTreeChangesSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return 0; // i.e. undefined, speeds up the common case
        }

        let val;
        const stateMap = this._stateMap;
        const versionKeysAsStrings = this._versionKeysAsStrings;
        const changes = [];
        let changeCount = 0;
        const versionKeys = this._versionKeys;

        let version = iterator.data();

        do {

            val = stateMap.get(versionKeysAsStrings.get(version));

            if (val === undefined) {
                val = defaultVal;
            }

            changes[changeCount++] = [versionKeys.get(version), val];

        } while ((version = iterator.next()) !== null);

        return changes;

    }

    _writeIntentAndReturnItsInfo (intent) {

        const info = super._writeIntentAndReturnItsInfo(intent);

        const changesAsJson = JsoAsJson(info.changes);

        this._changesStorage.addJsonToWriteQueue(changesAsJson);

        info.changesAsJson = changesAsJson;

        return info;

    }

    sync (clientInputAsJson) {

        const id = this._id;
        let newChanges = 0; // i.e. undefined
        let intentChangesAsJsonArray = 0; // i.e. undefined
        let inputWasRejected = 0; // i.e. false

        try {

            let clientInput;
            try {
                clientInput = JsoFromJson(clientInputAsJson);
                //^ should contain [id, version, intents]
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (clientInput === null) {
                rejectBadInput(new AssertionError());
            }

            let version;

            if (clientInput[0] === id) {

                version = clientInput[1];

                newChanges = this._VersionTreeChangesSince(
                    this._deletionVersionTree, 
                    version,
                    );

            }
            else {

                version = firstVersion;

            }

            if (newChanges === 0) { // i.e. undefined

                newChanges = this._VersionTreeChangesSince(
                    this._versionTree, 
                    version,
                    );

            }
            else {

                let i;
                const moreChanges = this._VersionTreeChangesSince(
                    this._versionTree, 
                    version,
                    );
                let changeCount = newChanges.length;

                for (i=moreChanges.length-1; i>=0; i--) {
                //^ reverse iteration is fine since trees don't contain 
                //  overwritten changes

                    newChanges[changeCount++] = moreChanges[i];

                }

            }

            //^ get the changes that've happened since the client last synced

            if (clientInput[2] !== 0) { // i.e. undefined

                let i;
                const intents = clientInput[2];
                let intentCount;
                try {
                    intentCount = intents.length;
                } catch (error) {
                    rejectBadInput(error);
                }
                intentChangesAsJsonArray = intents; 
                //^ they share the same array because they can and we want  
                //  server sync to be fast

                for (i=0; i<intentCount; i++) {

                    intentChangesAsJsonArray[i] = (
                        this._writeIntentAndReturnItsInfo(intents[i])
                        .changesAsJson
                        );

                }

            }

            //^ add the changes resulting from the client's intents

        } catch (error) {

            if (error.rejectedBadInput === true 
            && error.hasOwnProperty(`reason`)) {

                inputWasRejected = 1; // i.e. true
                console.log(error);

            }
            else {

                throw error;

            }

        }

        return JsoAsJson(
            [id, this._currentVersion, intentChangesAsJsonArray, newChanges, 
             inputWasRejected]
            );

    }

    _writeChangeEventToState (changeEvent) {

        super._writeChangeEventToState(changeEvent);

        const keyAsStringVersions = this._keyAsStringVersions;
        const keyAsString = changeEvent.keyAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);
        const versionKeys = this._versionKeys;
        const versionKeysAsStrings = this._versionKeysAsStrings;

        if (oldVersion !== undefined) {

            versionKeys.delete(oldVersion);
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

        versionKeys.set(newVersion, changeEvent.key);
        versionKeysAsStrings.set(newVersion, keyAsString);

        if (changeEvent.valAsString === defaultValAsString) {

            this._deletionVersionTree.insert(newVersion);

        }
        else {

            this._versionTree.insert(newVersion);

        }

    }

    };
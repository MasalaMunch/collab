"use strict";

const RbTree = require(`bintrees`).RBTree;

const {assert, CollabBase} = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresValsAsStrings = require(`./CollabStateThatStoresValsAsStrings.js`);
const CollabServerStorageViaLogFile = require(`./CollabServerStorageViaLogFile.js`);
const DummyCollabServerStorage = require(`./DummyCollabServerStorage.js`);
const CollabError = require(`./CollabError.js`);

const VersionComparison = (a, b) => a - b;

const firstVersion = 0;

module.exports = class extends CollabBase {

    constructor (config) {

        if (config.CollabState === undefined) {
            config.CollabState = CollabStateThatStoresValsAsStrings;
        }

        super(config);

        let {collabServerStorage, storagePath} = config;

        if (collabServerStorage === undefined) {

            if (storagePath === undefined) {

                collabServerStorage = new CollabServerStorageViaLogFile({
                    path: config.storagePath,
                    defaultValAsString: this._defaultValAsString,
                    });

            }
            else {

                collabServerStorage = new DummyCollabServerStorage();
                //TODO implement

            }

        }

        assert(typeof collabServerStorage.Changes === `function`);
        assert(
            typeof collabServerStorage.atomicallyWriteChanges 
            === `function`
            );

        this._storage = collabServerStorage;

        this._processId = Math.random();

        this._keyAsStringVersions = new Map();
        this._versionKeysAsStrings = new Map();

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._currentVersion = firstVersion;

        const storageChanges = this._storage.Changes();

        for (let i=0; i<storageChanges.length; i++) {

            this._normalizeStorageChange(storageChanges[i]);
            this._writeChangeToState(storageChanges[i]);

        }

    }

    *_VersionTreeChangesForSyncSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return; // speeds up the common case
        }

        const changesForSync = [];
        let changeCount = 0;

        const versionKeysAsStrings = this._versionKeysAsStrings;
        const state = this.state;

        let version = iterator.data();
        let keyAsString;

        do {

            keyAsString = versionKeysAsStrings.get(version);
            changesForSync[changeCount++] = [
                keyAsString, 
                state.ValAsStringOfKeyAsString(keyAsString),
                ];

        } while ((version = iterator.next()) !== null);

        return changesForSync;

    }

    _atomicallyWriteIntentAndItsChangesToStorage (intent, changes) {

        this._storage.atomicallyWriteChanges(changes);

    }

    sync (clientInputAsJson) {

        const clientInput = FromJson(clientInputAsJson);
        //^ clientInput contains [serverProcessId, version, intentsAsStrings]
        const processId = this._processId;
        let version;
        let changesForSync;

        if (clientInput[0] === processId) {

            version = clientInput[1];

            changesForSync = this._VersionTreeChangesForSyncSince(
                this._deletionVersionTree, 
                version,
                );

        }
        else {

            version = firstVersion;

        }

        if (changesForSync === undefined) {

            changesForSync = this._VersionTreeChangesForSyncSince(
                this._versionTree, 
                version,
                );

        }
        else {

            let i;
            const moreChangesForSync = this._VersionTreeChangesForSyncSince(
                this._versionTree, 
                version,
                );
            let changeCount = changesForSync.length;

            for (i=moreChangesForSync.length-1; i>=0; i--) {
            //^ reverse iteration is fine since trees don't contain overwritten 
            //  changes

                changesForSync[changeCount++] = moreChangesForSync[i];

            }

        }

        //^ get the changes that've happened since the client last synced

        if (clientInput[2] !== null) { // speeds up the common case

            let i;
            const intentsAsStrings = clientInput[2];
            const intentCount = intentsAsStrings.length;
            if (typeof intentCount !== `number`) {
                throw new CollabError(
                    new TypeError(`intentsAsStrings.length must be a number`)
                    );
            }
            //^ otherwise a client could pass in {length: "Infinity"} and force
            //  the server into an infinite loop (json doesn't allow Infinity so 
            //  checking that its type is number is sufficient)
            let ias;
            const IntentFromString = this._IntentFromString;

            for (i=0; i<intentCount; i++) {

                ias = intentsAsStrings[i];
                if (typeof ias !== `string`) {
                    throw new CollabError(
                        new TypeError(`each item in intentsAsStrings must be a string`)
                        );
                }
                try {
                    intentsAsStrings[i] = IntentFromString(ias);
                }
                catch (error) {
                    throw new CollabError(error);
                }

            }

            this._writeIntentsToStateAndStorageAndReturnTheirChanges(
                intentsAsStrings
                );
            
            //^ replace every entry in intentsAsStrings with its corresponding 
            //  intent, then write

        }

        //^ do the client's intents

        return AsJson([processId, this._currentVersion, changesForSync]);

    }

    _writeChangeToState (change) {

        super._writeChangeToState(change);

        const keyAsString = change.keyAsString;
        const keyAsStringVersions = keyAsStringVersions;
        const versionKeysAsStrings = this._versionKeysAsStrings;
        const defaultValAsString = defaultValAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);

        if (oldVersion !== undefined) {

            versionKeysAsStrings.delete(oldVersion);

            if (change.oldValAsString === defaultValAsString) {

                this._deletionVersionTree.remove(oldVersion);

            }
            else {

                this._versionTree.remove(oldVersion);

            }

        }

        const newVersion = ++this._currentVersion;

        keyAsStringVersions.set(keyAsString, newVersion);

        versionKeysAsStrings.set(newVersion, keyAsString);

        if (change.valAsString === defaultValAsString) {

            this._deletionVersionTree.insert(newVersion);

        }
        else {

            this._versionTree.insert(newVersion);

        }

    }

};
"use strict";

const IsString = require(`is-string`);
const RbTree = require(`bintrees`).RBTree;

const {assert, Collab} = require(`@masalamunch/collab-utils`);

const CollabServerStorage = require(`./CollabServerStorage.js`);
const CollabStateThatStoresValsAsStrings = require(`./CollabStateThatStoresValsAsStrings.js`);

const IsArray = Array.isArray;

const firstVersion = 0;

const VersionComparison = (a, b) => a - b;

module.exports = class extends Collab {

    constructor (config) {

        if (config.CollabState === undefined) {
            config.CollabState = CollabStateThatStoresValsAsStrings;
        }

        super(config);

        this._processId = Math.random();

        this._keyAsStringVersions = new Map();
        this._versionKeyAsStrings = new Map();

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._currentVersion = firstVersion;

        if (config.collabServerStorage === undefined) {

            if (config.storagePath !== undefined) {

                config.collabServerStorage = (
                    new CollabServerStorageViaLogFile({
                        path: config.storagePath,
                        defaultValAsString: this._defaultValAsString,
                        })
                    );

            }

        }

        this._storage = config.collabServerStorage;

        if (this._storage !== undefined) {

            const storageChanges = this._storage.Changes();

            for (let i=0; i<storageChanges.length; i++) {

                this._normalizeStorageChange(storageChanges[i]);
                this._writeChangeToMemory(storageChanges[i]);

            }

        }

    }

    *_VersionTreeChangesForSyncSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return; // speeds up the common case
        }

        const output = [];

        const versionKeyAsStrings = this._versionKeyAsStrings;
        const state = this.state;

        let version = iterator.data();
        let keyAsString;

        do {

            keyAsString = versionKeyAsStrings.get(version);
            output.push([keyAsString, state.ValAsStringOfKeyAsString(keyAsString)]);

        } while ((version = iterator.next()) !== null);

        return output;

    }

    //TODO only keep actions in memory, you'll avoid adding a lot of of complex 
    //     code, and the only cost a feature that no one will miss
    //     (undo/redo that persists on page reload)

    _doClientIntentsAsStrings (intentsAsStrings) {

        if (IsArray(intentsAsStrings)) {
            throw new TypeError(`IntentAsStrings isn't an array`);
        }

        let i;
        const intentCount = intentsAsStrings.length;
        let ias;
        const IntentFromString = this._IntentFromString;
        const IntentAsChanges = this._IntentAsChanges;
        const state = this.state;
        const derivedState = this.derivedState;
        let changes;
        let changeCount;
        let j;
        let c;
        const storage = this._storage;

        for (i=0; i<intentCount; i++) {

            ias = intentsAsStrings[i];
            if (!IsString)
            changes = this._IntentAsChanges(intentsAsStrings[i], state, derivedState);
            changeCount = changes.length;

            for (j=0; j<changeCount; j++) {

                c = changes[i];
                this._normalizeIntentChange(c);
                this._writeChangeToMemory(c);

            }

            storage.atomicallyAddChangesToWriteQueue(changes);
            //^ must do after the loop because the changes need to be normalized

        }

    }

    sync (clientInput) {
        
        //^ clientInput contains [serverProcessId, version, intentsAsStrings]

        //TODO don't let the server get messed up by malformed (and possibly 
        //     malicious) client input!!!

        const processId = this._processId;
        let clientVersion;
        let changesForSync;

        if (processId === clientInput[0]) {

            clientVersion = clientInput[1];

            changesForSync = this._VersionTreeChangesForSyncSince(
                this._deletionVersionTree, 
                clientVersion,
                );

        }
        else {

            clientVersion = firstVersion;

        }

        if (changesForSync === undefined) {

            changesForSync = this._VersionTreeChangesForSyncSince(
                this._versionTree, 
                clientVersion,
                );

        }
        else {

            let i;
            const additionalChanges = this._VersionTreeChangesForSyncSince(
                this._versionTree, 
                clientVersion,
                );

            for (i=additionalChanges.length-1; i>=0; i--) {
            //^ reverse iteration is fine since trees don't contain overwritten 
            //  changes

                changesForSync.push(additionalChanges[i]);

            }

        }

        if (clientInput[2] !== null) { // speeds up the common case

            this._doClientIntentsAsStrings(clientInput[2]);

        }

        return [processId, this._currentVersion, changesForSync];

    }

    _writeChangeToMemory (change) {

        super._writeChangeToMemory(change);

        const keyAsString = change.keyAsString;
        const keyAsStringVersions = keyAsStringVersions;
        const versionKeyAsStrings = this._versionKeyAsStrings;
        const defaultValAsString = defaultValAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);

        if (oldVersion !== undefined) {

            versionKeyAsStrings.delete(oldVersion);

            if (change.oldValAsString === defaultValAsString) {

                this._deletionVersionTree.remove(oldVersion);

            }
            else {

                this._versionTree.remove(oldVersion);

            }

        }

        const newVersion = ++this._currentVersion;

        keyAsStringVersions.set(keyAsString, newVersion);

        versionKeyAsStrings.set(newVersion, keyAsString);

        if (change.valAsString === defaultValAsString) {

            this._deletionVersionTree.insert(newVersion);

        }
        else {

            this._versionTree.insert(newVersion);

        }

    }

};
"use strict";

const {assert, CollabBase, Queue} = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresVals = require(`./CollabStateThatStoresVals.js`);
const DummyCollabClientStorage = require(`./DummyCollabClientStorage.js`);
const CollabClientStorageViaLocalStorage = require(`./CollabClientStorageViaLocalStorage.js`);

//TODO replace current storage abstraction with lower-level streamed storage abstractions

module.exports = class extends CollabBase {

    constructor (config) {

        if (config.CollabState === undefined) {
            config.CollabState = CollabStateThatStoresVals;
        }

        super(config);

        let {collabClientStorage, localStoragePrefix} = config;

        if (collabClientStorage === undefined) {

            if (localStoragePrefix === undefined) {

                collabClientStorage = new DummyCollabClientStorage();

            }
            else {

                collabClientStorage = new CollabServerStorageViaLogFile({
                    prefix: localStoragePrefix,
                    defaultValAsString: this._defaultValAsString,
                    });

            }

        }

        assert(typeof collabClientStorage.ChangesAndVersion === `function`);
        assert(typeof collabClientStorage.writeChangesAndVersion === `function`);

        this._storage = collabClientStorage;

        this._serverId = undefined;

        const storedChangesAndVersionAndIntents = (
            this._storage.ChangesAndVersionAndIntents()
            );

        this._currentVersion = storedChangesAndVersionAndIntents[1];

        this._writeStoredChanges(storedChangesAndVersionAndIntents[0]);

        this._bufferedActions = [];
        this._bufferedActionIntents = [];
        this._bufferReversingChanges = new Map();

        //TODO also read storage intents and do those

    }

    _writeIntentAndReturnItsChanges (intent, intentAsString) {

        const changes = super._writeIntentAndReturnItsChanges(intent, intentAsString);

        //TODO

        return changes;

    }

    startSync () {



    }

    finishSync (serverOutput) {



    }

    cancelSync () {



    }

};

const CollabClientClassInterface = class {

    constructor (coreConfig) {
        this._coreConfig = coreConfig;
    }

    Client (clientConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assign(config, clientConfig);
        return new CollabClient(config);
    }

};

module.exports = ClassFactory(CollabClientClassInterface);
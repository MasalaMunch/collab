"use strict";

const EscapedForRegExp = require('escape-string-regexp');

const {assert, CollabBase, CollabStateBase, firstVersion, ClassFactory, doNothing,
       Queue} = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresVals = class extends CollabStateBase {

    ValOfKeyAsString (keyAsString) {

        const val = this._map.get(keyAsString);
        return (
            val === undefined? 
            this.defaultVal : val
            );

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const val = this._map.get(keyAsString);
        return (
            val === undefined? 
            this.defaultValAsString : this.ValAsString(val)
            );

    }

    _writeChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.val);
        }

    }

};

const JSONparse = JSON.parse;

const JSONstringify = JSON.stringify;

const CollabClientStorageViaLocalStorage = class extends CollabStorageBase {

    constructor ({prefix}) {

        this._versionKey = prefix + `v`;
        this._dataPrefix = prefix + `d/`;
        //TODO support writing intents

    }

    ChangesAndVersion () {

        let i;
        let key;
        const dataPrefixRegExp = new RegExp(`^`+EscapedForRegExp(this._dataPrefix));
        let item;
        let valAsString;
        const version = (
            localStorage.getItem(this._versionKey) === null? 
            firstVersion : Number(localStorage.getItem(this._versionKey))
            );
        const defaultValAsString = this._defaultValAsString;
        const changes = [];
        const dataPrefixLength = this._dataPrefix.length;

        for (i=localStorage.length-1; i>=0; i--) {

            key = localStorage.key(n);

            if (dataPrefixRegExp.test(key)) {

                item = JSONparse(localStorage.getItem(key));
                valAsString = item[1] > version? item[0] : item[2];
                //^ item contains [oldValAsString, version, valAsString]

                if (valAsString === defaultValAsString) {
                    localStorage.removeItem(valAsString);
                }
                else {                
                    changes.push({
                        keyAsString: key.substring(dataPrefixLength, key.length),
                        valAsString,
                        });
                }

            }

        }

        return [changes, version];

    }

    atomicallyAddChangesAndVersionToWriteQueue (changes, version) {

        let i;
        const changeCount = changes.length;
        let c;
        const dataPrefix = this._dataPrefix;

        for (i=0; i<changeCount; i++) {

            c = changes[i];

            localStorage.setItem(
                dataPrefix + c.keyAsString, 
                JSONstringify([c.oldValAsString, version, c.valAsString]),
                );

        }

        localStorage.setItem(this._versionKey, String(version));

    }

};

//TODO serverProcessId stuff

const CollabClient = class extends CollabBase {

    constructor (config) {

        if (config.CollabState === undefined) {
            config.CollabState = CollabStateThatStoresVals;
        }

        if (config.collabClientStorage === undefined) {

            if (config.localStoragePrefix !== undefined) {

                config.collabClientStorage = (
                    new CollabClientStorageViaLocalStorage({
                        prefix: config.localStoragePrefix,
                        })
                    );

            }

        }

        config.collabStorage = config.collabClientStorage;

        super(config);

        this._serverProcessId = undefined;

    }

    do (intent) {

    }

    _writeChangeToMemory (change) {

        

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
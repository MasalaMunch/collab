"use strict";

const {assert, CollabBase, CollabMapThatStoresVals, firstVersion, 
       ClassFactory} = require(`@masalamunch/collab-utils`);

const EscapedForRegExp = (string) => {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); 
    //SRC^ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
};

const JSONparse = JSON.parse;

const JSONstringify = JSON.stringify;

const CollabStorageViaLocalStorage = class {

    constructor ({path, defaultValAsString}) {

        const prefix = path + `/`;
        this._versionKey = prefix + `v`;
        this._dataPrefix = prefix + `d/`;
        //TODO support writing transactions

        this._defaultValAsString = defaultValAsString;

    }

    Version () {
        const storedVersion = localStorage.getItem(this._versionKey);
        return storedVersion === null? firstVersion : Number(storedVersion);
    }

    AllChanges () {

        let i;
        let key;
        const dataPrefixRegExp = new RegExp(
            `^` + EscapedForRegExp(this._dataPrefix)
            );
        let item;
        let valAsString;
        const version = this.Version();
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

        return changes;

    }

    addAtomizedChangesToWriteQueue (changes, version) {

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

        defIn(config, {CollabMap: CollabClientMap});
        super(config);

        const {handleChange, ReversedTransaction} = config;

        if (handleChange) {
            assert(handleChange instanceof Function);
            this._handleChange = handleChange;
        }

        if (ReversedTransaction) {
            assert(ReversedTransaction instanceof Function);
            this._ReversedTransaction = ReversedTransaction;
        }

        this._readStorage();


    }

    do (transaction) {



    }

    undo () {



    }

    redo () {



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
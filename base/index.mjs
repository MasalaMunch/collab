import assert from "assert";

import JSONstringifyWithSortedKeys from "fast-json-stable-stringify";
import {RBTree as RbTree} from "bintrees";

const StringComparison = (a, b) => a.localeCompare(b);

//TODO make clients reset on server restarts

const CollabTree = class {

    constructor (ToString, FromString) {

        this._tree = new RbTree(StringComparison);

        this._ToString = ToString;
        this._FromString = FromString;

    }

    //TODO figure out tree interface

};

const verifyCompatibilityWithJsonStringify = (something) => {
    if (something === undefined) {
        throw new TypeError("undefined is not JSON serializable");
    }
};

const AsJson = (something) => {
    verifyCompatibilityWithJsonStringify(something);
    return JSON.stringify(something);
};

const AsJsonWithSortedKeys = (something) => {
    verifyCompatibilityWithJsonStringify(something);
    return JSONstringifyWithSortedKeys(something);
};

const FromJson = JSON.parse;


const DefaultTransactionAsChanges = function (transaction, keyVals, 
                                              derivedState, KeyHasChanged) {
    return transaction.filter([key, val] => !KeyHasChanged(key));
};

const firstVersion = 0;

const updateSortedKeys = (change, state, derivedState) => {

    derivedState.sortedKeys._tree
        [state._map.has(change.keyAsString)? "insert" : "remove"]
            (change.keyAsString);

};

const BaseCollab = class {

    constructor ({storagePath,
                  CollabStorage,
                  CollabMap,
                  defaultVal=null, 
                  TransactionAsChanges=DefaultTransactionAsChanges, 
                  updateDerivedState, 
                  shouldAddSortedKeysToDerivedState=false, 
                  KeyAsString=AsJsonWithSortedKeys,
                  KeyFromString=FromJson,
                  ValAsString=AsJsonWithSortedKeys,
                  ValFromString=FromJson,
                  TransactionAsString=AsJson,
                  TransactionFromString=FromJson}) {


        assert(KeyAsString instanceof Function);
        this._KeyAsString = KeyAsString;

        assert(KeyFromString instanceof Function);
        this._KeyFromString = KeyFromString;

        assert(ValAsString instanceof Function);
        this._ValAsString = ValAsString;

        assert(ValFromString instanceof Function);
        this._ValFromString = ValFromString;

        assert(TransactionAsString instanceof Function);
        this._TransactionAsString = TransactionAsString;

        assert(TransactionFromString instanceof Function);
        this._TransactionFromString = TransactionFromString;


        this._defaultVal = defaultVal;
        this._defaultValAsString = this._ValAsString(this._defaultVal);


        this.state = new CollabMap(
            this._KeyAsString, this._KeyFromString, 
            this._ValAsString, this._ValFromString, 
            this._defaultVal, this._defaultValAsString
            );


        this.derivedState = {};

        this._derivedStateUpdaters = [];

        if (shouldAddSortedKeysToDerivedState) {

            this.derivedState.sortedKeys = new CollabTree(
                this._KeyToString, this._KeyFromString
                );
            this._derivedStateUpdaters.push(updateSortedKeys);

        }

        if (updateDerivedState) {
            assert(updateDerivedState instanceof Function);
            this._derivedStateUpdaters.push(updateDerivedState);            
        }


        this._currentVersion = firstVersion;


        assert(TransactionAsChanges instanceof Function);
        this._TransactionAsChanges = TransactionAsChanges;


        if (storagePath || storagePath === ``) {
            this._storage = new CollabStorage({
                path: storagePath, 
                defaultValAsString: this._defaultValAsString,
                });
            assert(this._storage.AllChanges instanceof Function);
            assert(this._storage.addChangeToWriteQueue instanceof Function);
        }


    }

    _VersionOfKeyAsString (keyAsString) {
        const version = this._keyAsStringVersions.get(keyAsString);
        return version === undefined? firstVersion : version;
    }

    _readStorage () {

        if (this._storage) {

            const changes = this._storage.AllChanges();

            for (let i=0; i<changes.length; i++) {

                const {keyAsString, valAsString, _version} = changes[i];

                this._handleChange({
                    key: this._KeyFromString(keyAsString),
                    val: this._ValFromString(valAsString),
                    oldVal: this.state.ValOfKeyAsString(fc.keyAsString),
                    keyAsString,
                    valAsString,
                    oldValAsString: (
                        this.state.ValAsStringOfKeyAsString(fc.keyAsString)
                        ),
                    _version,
                    _isFromStorage: true,
                    });

            }

        }

    }

    _handleClientChange (clientChange) {
        //TODO process clientChanges as **a transaction and its context**
        // for optimal conflict resolution via HasChanged, make sure to filter 
        // changes that don't actually affect the value (i.e. that set it to 
        // what it already is)
    }

    _handleChange (change) {

        this.state._handleChange(change);

        this._keyAsStringVersions.set(change.keyAsString, change._version);

        for (let i=0; i<this._derivedStateUpdaters.length; i++) {
            this._derivedStateUpdaters[i](change, this.state, this.derivedState);
        }

        if (!change._isFromStorage) {
            this._storage.addChangeToWriteQueue(change);
        }

    }

};


const BaseCollabMap = class {

    constructor (KeyAsString, KeyFromString, ValAsString, ValFromString, 
                 defaultVal, defaultValAsString) {

        this._map = new Map();

        this.KeyAsString = KeyAsString;
        this.KeyFromString = KeyFromString;
        this.ValAsString = ValAsString;
        this.ValFromString = ValFromString;
        this.defaultVal = defaultVal;
        this.defaultValAsString = defaultValAsString;

    }

    HasKeyAsString (keyAsString) {
        return this._map.has(keyAsString);
    }

    Has (key) {
        return this.HasKeyAsString(this.KeyAsString(key));
    }

    ValOf (key) {
        return this.ValOfKeyAsString(this.KeyAsString(key));
        //^ ValOfKeyAsString should be implemented in a child class
    }

    KeysAsStrings () {
        return this._map.keys();
    }

    *Keys () {

        for (const keyAsString of this.KeysAsStrings()) {
            yield this.KeyFromString(keyAsString);
        }

    }

    Size () {
        return this._map.size;
    }

};

export {BaseCollab, BaseCollabMap};
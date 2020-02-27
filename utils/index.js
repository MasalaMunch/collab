"use strict";

const JSONstringifyWithSortedKeys = require(`fast-json-stable-stringify`);

const assert = (somethingTruthy) => {
    if (!somethingTruthy) {
        throw `AssertionError`;
    }
};

const JSONstringify = JSON.stringify;

const undefinedToJsonErrMsg = `undefined is not JSON serializable`; 

const AsJson = (something) => {
    if (something === undefined) {
        throw new TypeError(undefinedToJsonErrMsg);
    }
    return JSONstringify(something);
};

const AsJsonWithSortedKeys = (something) => {
    if (something === undefined) {
        throw new TypeError(undefinedToJsonErrMsg);
    }
    return JSONstringifyWithSortedKeys(something);
};

const FromJson = JSON.parse;

const DefaultTransactionAsChanges = (transaction, state, derivedState) => {

    if (state.ValAsStringOf(transaction.key) 
    === state.ValAsString(transaction.assumedVal)) {
        return [transaction];
    }
    return [];

};

const doNothing = () => {};

const CollabBase = class {

    constructor ({CollabStorage,
                  CollabMap,
                  storagePath,
                  defaultVal=null, 
                  TransactionAsChanges=DefaultTransactionAsChanges, 
                  updateDerivedState=doNothing, 
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

        assert(updateDerivedState instanceof Function);
        this._updateDerivedState = updateDerivedState;

        assert(TransactionAsChanges instanceof Function);
        this._TransactionAsChanges = TransactionAsChanges;

        if (CollabStorage !== undefined) {
            if (storagePath !== undefined) {
                this._storage = new CollabStorage({
                    path: storagePath, 
                    defaultValAsString: this._defaultValAsString,
                    });
                assert(this._storage.AllChanges instanceof Function);
                assert(this._storage.addChangeToWriteQueue instanceof Function);            
            }
        }

    }

    _readStorage () {

        if (this._storage !== undefined) {

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
        //TODO process clientChanges as transactions
    }

    _handleChange (change) {

        this.state._handleChange(change);

        this._updateDerivedState(change, this.state, this.derivedState);

        if (!change._isFromStorage) {
            this._storage.addChangeToWriteQueue([change]);
        }

    }

};


const CollabMapBase = class {

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

    ValAsStringOf (key) {
        return this.ValAsStringOfKeyAsString(this.KeyAsString(key));
        //^ ValAsStringOfKeyAsString should be implemented in a child class
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

const CollabMapThatStoresValsAsStrings = class extends CollabMapBase {

    ValOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultVal : this.ValFromString(valAsString)
            );

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultValAsString : valAsString
            );

    }

    _handleChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.valAsString);
        }

    }

};

const CollabMapThatStoresVals = class extends CollabMapBase {

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

    _handleChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.val);
        }

    }

};

const firstVersion = 0;

const ClassFactory = (Class) => (...args) => new Class(...args);

Object.assign(
    module.exports, 
    {assert, CollabBase, CollabMapThatStoresValsAsStrings, 
     CollabMapThatStoresVals, firstVersion, ClassFactory},
    );

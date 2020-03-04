"use strict";

const IsString = require(`is-string`);

const assert = require(`./assert.js`);
const doNothing = require(`./doNothing.js`);
const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const FromJson = require(`./FromJson.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

module.exports = class {

    constructor ({CollabState,
                  // rememberThisManyChanges,
                  IntentAsChanges=DefaultIntentAsChanges, 
                  updateDerivedState=doNothing, 
                  defaultVal=null, 
                  KeyAsString=AsJsonWithSortedKeys,
                  KeyFromString=FromJson,
                  ValAsString=AsJsonWithSortedKeys,
                  ValFromString=FromJson,
                  IntentAsString=AsJson,
                  // handleChange=doNothing,
                  IntentFromString=FromJson}) {

        assert(KeyAsString instanceof Function);
        this._KeyAsString = KeyAsString;

        assert(KeyFromString instanceof Function);
        this._KeyFromString = KeyFromString;

        assert(ValAsString instanceof Function);
        this._ValAsString = ValAsString;

        assert(ValFromString instanceof Function);
        this._ValFromString = ValFromString;

        assert(IntentAsString instanceof Function);
        this._IntentAsString = IntentAsString;

        assert(IntentFromString instanceof Function);
        this._IntentFromString = IntentFromString;

        this._defaultVal = defaultVal;

        const defaultValAsString = this._ValAsString(this._defaultVal);
        assert(IsString(defaultValAsString));
        this._defaultValAsString = defaultValAsString;

        this.state = new CollabState(
            this._KeyAsString, this._KeyFromString, 
            this._ValAsString, this._ValFromString, 
            this._defaultVal, this._defaultValAsString
            );

        this.derivedState = {};

        assert(updateDerivedState instanceof Function);
        this._updateDerivedState = updateDerivedState;

        // assert(handleChange instanceof Function);
        // this._handleChange = handleChange;

        assert(IntentAsChanges instanceof Function);
        this._IntentAsChanges = IntentAsChanges;

        // this._rememberThisManyChanges = rememberThisManyChanges;
        // this._changeCount = 0;
        // this._actionChanges = new Map();
        // this._actionQueue = new Queue();
        // this._nextAction = Number.MIN_SAFE_INTEGER;

    }

    _writeChangeToMemory (change) {

        const state = this.state;
        state._writeChange(change);
        this._updateDerivedState(change, state, this.derivedState);
        // this._handleChange(change, state, derivedState);

    }

    _normalizeStorageChange (storageChange) {

        const keyAsString = storageChange.keyAsString;
        storageChange.key = this._KeyFromString(keyAsString);
        storageChange.val = this._ValFromString(storageChange.valAsString);
        const state = this.state;
        storageChange.oldVal = state.ValOfKeyAsString(keyAsString);
        storageChange.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

    }

    _normalizeIntentChange (intentChange) {

        const keyAsString = this._KeyAsString(intentChange.key);

        if (!IsString(keyAsString)) {
            throw new TypeError(`KeyAsString must return a string`);
        }

        intentChange.keyAsString = keyAsString;

        const valAsString = this._ValAsString(intentChange.val);

        if (!IsString(valAsString)) {
            throw new TypeError(`ValAsString must return a string`);
        }

        intentChange.valAsString = valAsString;

        const state = this.state;

        intentChange.oldVal = state.ValOfKeyAsString(keyAsString);
        intentChange.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

    }

    _do (intent) {

        

    }

    // ChangesOfAction (action) {
    //     return this._actionChanges.get(action);
    // }

};
"use strict";

const assert = require(`./assert.js`);
const Queue = require(`./Queue.js`);
const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const FromJson = require(`./FromJson.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

const doNothing = () => {};

const emptyChangeSizeApproximation = 1;

module.exports = class {

    constructor ({CollabState,
                  rememberThisManyChanges=0,
                  IntentAsChanges=DefaultIntentAsChanges, 
                  updateDerivedState=doNothing, 
                  defaultVal=null, 
                  KeyAsString=AsJsonWithSortedKeys,
                  KeyFromString=FromJson,
                  ValAsString=AsJsonWithSortedKeys,
                  ValFromString=FromJson,
                  IntentAsString=AsJson,
                  handleChange=doNothing,
                  IntentFromString=FromJson}) {

        assert(typeof KeyAsString === `function`);
        this._KeyAsString = KeyAsString;

        assert(typeof KeyFromString === `function`);
        this._KeyFromString = KeyFromString;

        assert(typeof ValAsString === `function`);
        this._ValAsString = ValAsString;

        assert(typeof ValFromString === `function`);
        this._ValFromString = ValFromString;

        assert(typeof IntentAsString === `function`);
        this._IntentAsString = IntentAsString;

        assert(typeof IntentFromString === `function`);
        this._IntentFromString = IntentFromString;

        this._defaultVal = defaultVal;

        const defaultValAsString = this._ValAsString(this._defaultVal);
        assert(typeof defaultValAsString === `string`);
        this._defaultValAsString = defaultValAsString;

        this.state = new CollabState(
            this._KeyAsString, this._KeyFromString, 
            this._ValAsString, this._ValFromString, 
            this._defaultVal, this._defaultValAsString
            );

        this.derivedState = {};

        assert(typeof updateDerivedState === `function`);
        this._updateDerivedState = updateDerivedState;

        assert(typeof handleChange === `function`);
        this._handleChange = handleChange;

        assert(typeof IntentAsChanges === `function`);
        this._IntentAsChanges = IntentAsChanges;

        assert(
            typeof rememberThisManyChanges === `number` 
            && rememberThisManyChanges >= 0
            );
        this._rememberThisManyChanges = rememberThisManyChanges;
        this._changeCount = 0;
        this._actionChanges = new Map();
        this._actionIntents = new Map();
        this._actionQueue = new Queue();
        this._nextAction = Number.MIN_SAFE_INTEGER;

    }

    do (intent) {

        const changes = this._writeIntentsAndReturnTheirChanges([intent])[0];

        this._changeCount += changes.length + emptyChangeSizeApproximation;

        const action = this._nextAction++;

        this._actionQueue.add(action);
        this._actionChanges.set(action, changes);
        this._actionIntents.set(action, intent);

        while (this._changeCount > this._rememberThisManyChanges) {
        //^ don't need to check if actionQueue is empty because that would imply
        //  that changeCount is 0, which would make the while condition false
        //  because rememberThisManyChanges is not negative

            const forgetThisAction = this._actionQueue.OldestItem();

            this._changeCount -= (
                this._actionChanges.get(forgetThisAction).length 
                + emptyChangeSizeApproximation
                );

            this._actionQueue.deleteOldestItem();
            this._actionChanges.delete(forgetThisAction);
            this._actionIntents.delete(forgetThisAction);

        }
            
        return action;

    }

    _writeIntentsAndReturnTheirChanges (intents) {

        let i;
        const intentCount = intents.length;
        let n;
        let changes;
        const IntentAsChanges = this._IntentAsChanges;
        const state = this.state;
        const derivedState = this.derivedState;
        let changeCount;
        let j;
        let c;
        let keyAsString;
        const KeyAsString = this._KeyAsString;
        let valAsString;
        const ValAsString = this._ValAsString;
        const intentChanges = [];

        for (i=0; i<intentCount; i++) {

            n = intents[i];
            changes = IntentAsChanges(n, state, derivedState);
            changeCount = changes.length;

            for (j=0; j<changeCount; j++) {

                c = changes[j];

                keyAsString = KeyAsString(c.key);

                if (typeof keyAsString !== `string`) {
                    throw new TypeError(`KeyAsString must return a string`);
                }

                c.keyAsString = keyAsString;

                valAsString = ValAsString(c.val);

                if (typeof valAsString !== `string`) {
                    throw new TypeError(`ValAsString must return a string`);
                }

                c.valAsString = valAsString;

                c.oldVal = state.ValOfKeyAsString(keyAsString);
                c.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

                this._writeChangeToMemory(c);

            }

            this._atomicallyAddIntentAndItsChangesToStorageWriteQueue(n, changes);
            //^ should be implemented by child class

            intentChanges[i] = changes;

        }

        return intentChanges;

    }

    _normalizeStorageChange (storageChange) {

        const keyAsString = storageChange.keyAsString;
        storageChange.key = this._KeyFromString(keyAsString);
        storageChange.val = this._ValFromString(storageChange.valAsString);
        const state = this.state;
        storageChange.oldVal = state.ValOfKeyAsString(keyAsString);
        storageChange.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

    }

    _writeChangeToMemory (change) {

        const state = this.state;
        state._writeChange(change);
        const derivedState = this.derivedState;
        this._updateDerivedState(change, state, derivedState);
        this._handleChange(change, state, derivedState);

    }

    IntentOfAction (action) {
        return this._actionIntents.get(action);
    }

    ChangesOfAction (action) {
        return this._actionChanges.get(action);
    }

};
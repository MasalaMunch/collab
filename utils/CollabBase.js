"use strict";

const assert = require(`./assert.js`);
const Queue = require(`./Queue.js`);
const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const FromJson = require(`./FromJson.js`);
const rejectBadInput = require(`./rejectBadInput.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

const doNothing = () => {};

const emptyArraySizeApproximationInChanges = 1;

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
        //^ remember some local actions (useful for implementing undo-redo)

    }

    do (intent) {

        const changes = (
            this._writeIntentsToStateAndStorageAndReturnTheirChanges([intent])[0]
            );

        this._changeCount += changes.length + emptyArraySizeApproximationInChanges;

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
                + emptyArraySizeApproximationInChanges
                );

            this._actionQueue.deleteOldestItem();
            this._actionChanges.delete(forgetThisAction);
            this._actionIntents.delete(forgetThisAction);

        }
            
        return action;

    }

    _writeIntentsToStateAndStorageAndReturnTheirChanges (intents) {

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
        const KeyFromString = this._KeyFromString;
        let valAsString;
        const ValAsString = this._ValAsString;
        const ValFromString = this._ValFromString;
        const intentChanges = [];

        for (i=0; i<intentCount; i++) {

            n = intents[i];
            try {
                changes = IntentAsChanges(n, state, derivedState);
            } catch (error) {
                rejectBadInput(error);
            }
            try {
                changeCount = changes.length;
            } catch (error) {
                rejectBadInput(error);
            }

            for (j=0; j<changeCount; j++) {

                c = changes[j];

                try {
                    keyAsString = KeyAsString(c.key);
                }
                catch (error) {
                    rejectBadInput(error);
                }
                if (typeof keyAsString !== `string`) {
                    rejectBadInput(new TypeError(
                        `KeyAsString didn't return a string`
                        ));
                }
                c.keyAsString = keyAsString;

                try {
                    valAsString = ValAsString(c.val);
                }
                catch (error) {
                    rejectBadInput(error);
                }
                if (typeof valAsString !== `string`) {
                    rejectBadInput(new TypeError(
                        `ValAsString didn't return a string`
                        ));
                }
                c.valAsString = valAsString;

                //^ fill in string versions of key and val

                try {
                    c.key = KeyFromString(keyAsString);
                }
                catch (error) {
                    rejectBadInput(error);
                }

                try {
                    c.val = ValFromString(valAsString);
                }
                catch (error) {
                    rejectBadInput(error);
                }

                //^ ensures that both the doer of the intent and others who 
                //  receive the intent's changes will process the same key and 
                //  val in their _writeChangeToState functions - in a perfect 
                //  world this wouldn't be necessary, but it's here because it 
                //  makes it impossible to introduce certain tricky-to-debug 
                //  bugs, and therefore makes collab more developer-friendly

            }

            for (j=0; j<changeCount; j++) {

                c = changes[j];

                c.oldVal = state.ValOfKeyAsString(keyAsString);
                c.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

                this._writeChangeToState(c);

            }

            this._atomicallyWriteIntentAndItsChangesToStorage(n, changes);
            //^ should be implemented by child class, is called after the loops 
            //  so that all the changes have the correct properties

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

    _writeChangeToState (change) {

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
"use strict";

const assert = require(`./assert.js`);
const Queue = require(`./Queue.js`);
const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const FromJson = require(`./FromJson.js`);
const rejectBadInput = require(`./rejectBadInput.js`);
const doNothing = require(`./doNothing.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

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
                  handleChangeEvent=doNothing,
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

        assert(typeof handleChangeEvent === `function`);
        this._handleChangeEvent = handleChangeEvent;

        assert(typeof IntentAsChanges === `function`);
        this._IntentAsChanges = IntentAsChanges;

        assert(
            typeof rememberThisManyChanges === `number` 
            && rememberThisManyChanges >= 0
            );
        this._rememberThisManyChanges = rememberThisManyChanges;
        this._changeCount = 0;
        this._actionChangeEvents = new Map();
        this._actionIntents = new Map();
        this._actionQueue = new Queue();
        this._nextAction = Number.MIN_SAFE_INTEGER;
        //^ remember some local actions (useful for implementing undo-redo)

    }

    do (intent) {

        let intentAsString;
        try {
            intentAsString = this._IntentAsString(intent);
        } catch (error) {
            rejectBadInput(error);
        }
        if (typeof intentAsString !== `string`) {
            rejectBadInput(new TypeError(
                `IntentAsString didn't return a string`
                ));
        }
        
        try {
            intent = this._IntentFromString(intentAsString);
            //^ ensures that both the doer of the intent and others who receive 
            //  the intent as a string will process the same thing in their 
            //  IntentAsChanges functions - in a perfect world this wouldn't be 
            //  necessary, but it's here because it makes it impossible to 
            //  introduce certain tricky-to-debug bugs
        } catch (error) {
            rejectBadInput(error);
        }

        const {changeEvents, action} = (
            this._writeIntentAndReturnItsInfo(intent, intentAsString, false)
            );

        this._changeCount += (
            changeEvents.length 
            + emptyArraySizeApproximationInChanges
            );

        this._actionQueue.add(action);
        this._actionChangeEvents.set(action, changeEvents);
        this._actionIntents.set(action, intent);

        while (this._changeCount > this._rememberThisManyChanges) {
        //^ don't need to check if actionQueue is empty because that would imply
        //  that changeCount is 0, which would make the while condition false
        //  because rememberThisManyChanges is not negative

            const forgetThisAction = this._actionQueue.OldestItem();

            this._changeCount -= (
                this._actionChangeEvents.get(forgetThisAction).length 
                + emptyArraySizeApproximationInChanges
                );

            this._actionQueue.deleteOldestItem();
            this._actionChangeEvents.delete(forgetThisAction);
            this._actionIntents.delete(forgetThisAction);

        }

        return action;

    }

    _writeIntentAndReturnItsInfo (intent, intentAsString, isFromStorage) {

        const state = this._state;
        const derivedState = this._derivedState;
        
        let changes;
        let changeCount;
        try {
            changes = this._IntentAsChanges(intent, state, derivedState);
            changeCount = changes.length;
        } catch (error) {
            rejectBadInput(error);
        }
        
        let i;
        let c;
        const KeyAsString = this._KeyAsString;
        let keyAsString;
        const ValAsString = this._ValAsString;
        let valAsString;
        const changeEvents = [];
        const KeyFromString = this._KeyFromString;
        const ValFromString = this._ValFromString;
        
        for (i=0; i<changeCount; i++) {

            c = changes[i]; // c contains [key, val]

            try {
                keyAsString = KeyAsString(c[0]);
                valAsString = ValAsString(c[1]);
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (typeof keyAsString !== `string`) {
                rejectBadInput(new TypeError(
                    `KeyAsString didn't return a string`
                    ));
            }
            if (typeof valAsString !== `string`) {
                rejectBadInput(new TypeError(
                    `ValAsString didn't return a string`
                    ));
            }

            try {

                changeEvents[i] = {

                    keyAsString, 
                    valAsString, 

                    key: KeyFromString(keyAsString),
                    val: ValFromString(valAsString),
                    //^ ensures that both the doer of the intent and others who 
                    //  receive the intent's changes will process the same key  
                    //  and val in their _writeChangeEventToState functions - in  
                    //  a perfect world this wouldn't be necessary, but it's   
                    //  here because it makes it impossible to introduce certain  
                    //  tricky-to-debug bugs

                    };

            } catch (error) {
                rejectBadInput(error);
            }

        }

        let e;

        for (i=0; i<changeCount; i++) {

            e = changeEvents[i];
            keyAsString = e.keyAsString;

            e.oldVal = state.ValOfKeyAsString(keyAsString);
            e.oldValAsString = state.ValAsStringOfKeyAsString(keyAsString);

            this._writeChangeEventToState(e);

        }

        return {changeEvents, action: this._nextAction++};

    }

    _StringChangeAsChangeEvent (stringChange) {

        const [keyAsString, valAsString] = stringChange;
        const state = this._state;

        return {

            keyAsString,
            valAsString,

            key: this._KeyFromString(keyAsString),
            val: this._ValFromString(valAsString),

            oldVal: state.ValOfKeyAsString(keyAsString),
            oldValAsString: state.ValAsStringOfKeyAsString(keyAsString),

            };
            
    }

    _writeChangeEventToState (changeEvent) {

        const state = this.state;

        state._writeChangeEvent(changeEvent);

        const derivedState = this.derivedState;
        
        this._updateDerivedState(changeEvent, state, derivedState);
        this._handleChangeEvent(changeEvent, state, derivedState);

    }

    IntentOfAction (action) {
        return this._actionIntents.get(action);
    }

    ChangeEventsOfAction (action) {
        return this._actionChangeEvents.get(action);
    }

};
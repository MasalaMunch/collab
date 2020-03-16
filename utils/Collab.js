"use strict";

const assert = require(`./assert.js`);
const Queue = require(`./Queue.js`);
const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const FromJson = require(`./FromJson.js`);
const rejectBadInput = require(`./rejectBadInput.js`);
const doNothing = require(`./doNothing.js`);
const FakeStringLog = require(`./FakeStringLog.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

module.exports = class {

    _CompressedStringChanges (stringChangesArray) {

        let i;
        let stringChanges;
        let j;
        let c;
        let keyAsString;
        const overwrittenKeysAsStrings = new Set();
        const defaultValAsString = this._defaultValAsString;
        const compressedStringChanges = [];
        let compressedChangeCount = 0;

        for (i=stringChangesArray.length-1; i>=0; i--) {

            stringChanges = stringChangesArray[i];

            for (j=stringChanges.length-1; j>=0; j--) {

                c = stringChanges[j]; // contains [keyAsString, valAsString]

                keyAsString = c[0];

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    if (c[1] !== defaultValAsString) {

                        compressedStringChanges[compressedChangeCount++] = c;

                    }

                }

            }

        }
        //^ filter out changes that:
        //
        //      are overwritten by a later change
        //      are deletions (valAsString === defaultValAsString)
        //
        //  (the remaining changes can be returned in the opposite order 
        //   they happened because they contain no overwritten changes)

        return compressedStringChanges;

    }

    constructor ({CollabState,
                  shouldRememberLocalActions=false,
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

        this._nextAction = Number.MIN_SAFE_INTEGER;
        this._actionIntents = new Map();
        this._actionChangeEvents = new Map();

        this._shouldRememberLocalActions = shouldRememberLocalActions;
        //^ remembering local actions is useful for implementing undo-redo

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

        if (this._shouldRememberLocalActions) {

            this._actionIntents.set(action, intent);
            this._actionChangeEvents.set(action, changeEvents);

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

    _writeStringChangesToState (stringChanges) {

        let i;
        const changeCount = stringChanges.length;
        let c;
        let keyAsString;
        let valAsString;
        const KeyFromString = this._KeyFromString;
        const ValFromString = this._ValFromString;
        const state = this._state;

        for (i=0; i<changeCount; i++) {

            c = stringChanges[i];
            keyAsString = c[0];
            valAsString = c[1];

            this._writeChangeEventToState({

                keyAsString,
                valAsString,

                key: KeyFromString(keyAsString),
                val: ValFromString(valAsString),

                oldVal: state.ValOfKeyAsString(keyAsString),
                oldValAsString: state.ValAsStringOfKeyAsString(keyAsString),

                });

        }

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
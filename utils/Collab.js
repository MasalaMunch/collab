"use strict";

const AsJson = require(`./AsJson.js`);
const AsJsonWithSortedKeys = require(`./AsJsonWithSortedKeys.js`);
const assert = require(`./assert.js`);
const AssertionError = require(`./AssertionError.js`);
const assignIfUndefined = require(`./assignIfUndefined.js`);
const CollabState = require(`./CollabState.js`);
const doNothing = require(`./doNothing.js`);
const firstVersion = require(`./firstVersion.js`);
const FromJson = require(`./FromJson.js`);
const IsFromRejectBadInput = require(`./IsFromRejectBadInput.js`);
const rejectBadInput = require(`./rejectBadInput.js`);

const defaultSchema = {

    IntentAsChanges: (intent, state, derivedState) => intent,

    updateDerivedState: doNothing,

    KeyAsString: AsJsonWithSortedKeys,
    KeyFromString: FromJson,

    ValAsString: AsJsonWithSortedKeys,
    ValFromString: FromJson,

    defaultVal: null,

    IntentAsString: AsJsonWithSortedKeys,
    IntentFromString: FromJson,

    };

module.exports = class {

    constructor ({schema, handleChangeEvent=doNothing,
                  shouldRememberLocalActions=false}) {

        const fullSchema = {};

        Object.assign(fullSchema, schema);

        assignIfUndefined(fullSchema, defaultSchema);

        const {IntentAsChanges, updateDerivedState, KeyAsString, KeyFromString, 
               ValAsString, ValFromString, defaultVal, IntentAsString, 
               IntentFromString} = fullSchema;

        assert(typeof IntentAsChanges === `function`);
        this._IntentAsChanges = IntentAsChanges;

        assert(typeof updateDerivedState === `function`);
        this._updateDerivedState = updateDerivedState;

        assert(typeof KeyAsString === `function`);
        this._KeyAsString = KeyAsString;

        assert(typeof KeyFromString === `function`);
        this._KeyFromString = KeyFromString;

        assert(typeof ValAsString === `function`);
        this._ValAsString = ValAsString;

        assert(typeof ValFromString === `function`);
        this._ValFromString = ValFromString;

        this._defaultVal = defaultVal;

        assert(typeof IntentAsString === `function`);
        this._IntentAsString = IntentAsString;

        assert(typeof IntentFromString === `function`);
        this._IntentFromString = IntentFromString;

        assert(typeof handleChangeEvent === `function`);
        this._handleChangeEvent = handleChangeEvent;

        assert(typeof shouldRememberLocalActions === `boolean`);
        this._shouldRememberLocalActions = shouldRememberLocalActions;
        //^ remembering local actions is useful for implementing undo-redo

        const defaultValAsString = this.ValAsString(this.defaultVal);
        assert(typeof defaultValAsString === `string`);
        this._defaultValAsString = defaultValAsString;

        this._keyAsStringVals = new Map();

        this._keyAsStringValAsStrings = new Map();

        this.state = new CollabState(
            this._keyAsStringVals, this._keyAsStringValAsStrings, 
            this._KeyAsString, this._KeyFromString, this._ValAsString, 
            this._ValFromString, this._defaultVal, this._defaultValAsString
            );

        this.derivedState = {};

        this._nextAction = Number.MIN_SAFE_INTEGER;

        this._actionIntents = new Map();

        this._actionChangeEvents = new Map();

        this._currentVersion = firstVersion;

    }

    do (intent) {

        const intentAsString = this._IntentAsString(intent);
        if (typeof intentAsString !== `string`) {
            throw new AssertionError();
        }

        intent = this._IntentFromString(intentAsString);
        //^ ensures that both the doer of the intent and others who receive 
        //  the intent as a string will process the same thing in their 
        //  IntentAsChanges functions - in a perfect world this wouldn't be 
        //  necessary, but it's here because it makes it impossible to introduce 
        //  certain tricky-to-debug bugs

        let info;
        try {
            info = this._writeIntent(intent, intentAsString);
        } catch (error) {
            throw IsFromRejectBadInput(error)? error.reason || error;
        }

        const action = info.action;

        if (this._shouldRememberLocalActions) {

            this._actionIntents.set(action, intent);
            this._actionChangeEvents.set(action, info.changeEvents);

        }

        return action;

    }


    IntentOfAction (action) {
        return this._actionIntents.get(action);
    }

    ChangeEventsOfAction (action) {
        return this._actionChangeEvents.get(action);
    }

    _writeIntent (intent, intentAsString) {
        
        let changes;
        let changeCount;
        try {
            changes = (
                this._IntentAsChanges(intent, this._state, this._derivedState)
                );
            changeCount = changes.length;
        } catch (error) {
            rejectBadInput(error);
        }
        if (typeof changeCount !== `number` || changeCount === Infinity) {
            throw new AssertionError();
        }
        let i;
        let c;
        const KeyAsString = this._KeyAsString;
        let keyAsString;
        const ValAsString = this._ValAsString;        
        let valAsString;
        let key;
        let val;
        
        for (i=0; i<changeCount; i++) {

            c = changes[i];

            try {
                keyAsString = KeyAsString(c.key);
                valAsString = ValAsString(c.val);
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (typeof keyAsString !== `string`) {
                rejectBadInput(new AssertionError());
            }
            if (typeof valAsString !== `string`) {
                rejectBadInput(new AssertionError());
            }
            c.keyAsString = keyAsString;
            c.valAsString = valAsString;

            try {
                c.key = KeyFromString(keyAsString);
                c.val = ValFromString(valAsString);
                //^ ensures that both the doer of the intent and others who 
                //  receive the intent's changes will process the same key  and 
                //  val in their _writeChangeEventToState functions - in  a 
                //  perfect world this wouldn't be necessary, but it's here 
                //  because it makes it impossible to introduce certain 
                //  tricky-to-debug bugs
            } catch (error) {
                rejectBadInput(error);
            }

        }

        this._fillPartialChangeEventsAndWriteThemToState(changes);
        //^ changes are now partialChangeEvents because of the modifications 
        //  made to them in the for loop

        return {
            changeEvents: changes, 
            //^ changes are now changeEvents because they've been filled by 
            //  this._fillPartialChangeEventsAndWriteThemToState
            action: this._nextAction++,
            };

    }

    _fillPartialChangeEventsAndWriteThemToState (partialChangeEvents) {

        let i;
        const changeCount = partialChangeEvents.length;
        let e;
        let keyAsString;
        let storedVal;
        const defaultVal = this._defaultVal;
        const defaultValAsString = this._defaultValAsString;
        const keyAsStringVals = this._keyAsStringVals;
        const keyAsStringValAsStrings = this._keyAsStringValAsStrings;

        for (i=0; i<changeCount; i++) {

            e = partialChangeEvents[i];

            keyAsString = e.keyAsString;

            storedVal = keyAsStringVals.get(keyAsString);

            if (storedVal === undefined) {

                e.oldVal = defaultVal;
                e.oldValAsString = defaultValAsString;

            }
            else {

                e.oldVal = storedVal;
                e.oldValAsString = keyAsStringValAsStrings.get(keyAsString);

            }

            this._writeChangeEventToState(e);

        }

    }

    _writeChangeEventToState (changeEvent) {

        const keyAsString = changeEvent.keyAsString;
        const valAsString = changeEvent.valAsString;

        if (valAsString === this._defaultValAsString) {

            this._keyAsStringVals.delete(keyAsString);
            this._keyAsStringValAsStrings.delete(keyAsString);

        }
        else {

            this._keyAsStringVals.set(keyAsString, changeEvent.val);
            this._keyAsStringValAsStrings.set(keyAsString, valAsString);

        }

        const state = this.state;
        const derivedState = this.derivedState;
        
        this._updateDerivedState(changeEvent, state, derivedState);
        this._handleChangeEvent(changeEvent, state, derivedState);

    }

    _CompressedStringChangesArray (stringChangesArray) {

        let i;
        let stringChanges;
        let j;
        let c;
        let keyAsString;
        const overwrittenKeysAsStrings = new Set();
        let valAsString;
        const defaultValAsString = this._defaultValAsString;
        const allStringChanges = [];
        const allPartialChangeEvents = [];
        let totalChangeCount = 0;

        for (i=stringChangesArray.length-1; i>=0; i--) {

            stringChanges = stringChangesArray[i];

            for (j=stringChanges.length-1; j>=0; j--) {

                c = stringChanges[j]; // contains [keyAsString, valAsString]

                keyAsString = c[0];

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    valAsString = c[1];

                    if (valAsString !== defaultValAsString) {

                        allStringChanges[totalChangeCount] = c;

                        allPartialChangeEvents[totalChangeCount] = {

                            keyAsString, 
                            valAsString, 

                            key: KeyFromString(keyAsString),
                            val: ValFromString(valAsString),

                            };

                        totalChangeCount++;

                    }

                }

            }

        }
        //^ filter out changes that:
        //
        //      are overwritten by a later change
        //      are deletions (valAsString === defaultValAsString)
        //
        //  (the remaining changes can be returned in the opposite order they 
        //   happened because they contain no overwritten changes)

        return {
            stringChanges: allStringChanges, 
            partialChangeEvents: allPartialChangeEvents,
            };

    }

    };
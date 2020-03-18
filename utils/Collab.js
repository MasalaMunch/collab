"use strict";

const AsJson = require(`./AsJson.js`);
const assert = require(`./assert.js`);
const AssertionError = require(`./AssertionError.js`);
const AsString = require(`./AsString.js`);
const CollabState = require(`./CollabState.js`);
const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const doNothing = require(`./doNothing.js`);
const FromJson = require(`./FromJson.js`);
const FromString = require(`./FromString.js`);
const rejectBadInput = require(`./rejectBadInput.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

module.exports = class {

    static _CompressedChangesFromJsonArray (changesFromJsonArray) {

        let i;
        let changesFromJson;
        let j;
        let c;
        let key;
        let keyAsString;
        const overwrittenKeysAsStrings = new Set();
        let val;
        let valAsString;
        const allChanges = [];
        const allPartialChangeEvents = [];
        let totalChangeCount = 0;

        for (i=changesFromJsonArray.length-1; i>=0; i--) {

            changesFromJson = changesFromJsonArray[i];

            for (j=changesFromJson.length-1; j>=0; j--) {

                c = changesFromJson[j]; // contains [key, val]

                key = c[0];
                keyAsString = AsString(key);

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    val = c[1];
                    valAsString = AsString(val);

                    if (valAsString !== defaultValAsString) {

                        allChanges[totalChangeCount] = c;

                        allPartialChangeEvents[totalChangeCount] = (
                            {key, keyAsString, val, valAsString}
                            );

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
        //  (the remaining changes can be returned in the opposite order 
        //   they happened because they contain no overwritten changes)

        return {
            changes: allChanges, 
            partialChangeEvents: allPartialChangeEvents,
            };

    }

    _normalizeAndWritePartialChangeEventsToState (partialChangeEvents) {

        let i;
        const changeCount = partialChangeEvents.length;
        let e;
        let storedVal;
        const stateMap = this._stateMap;

        for (i=0; i<changeCount; i++) {

            e = partialChangeEvents[i];

            storedVal = stateMap.get(e.keyAsString);

            if (storedVal === undefined) {

                e.oldVal = defaultVal;
                e.oldValAsString = defaultValAsString;

            }
            else {

                e.oldVal = storedVal;
                e.oldValAsString = AsString(storedVal);

            }

            this._writeChangeEventToState(e);

        }

    }

    constructor ({schema,
                  handleChangeEvent=doNothing,
                  shouldRememberLocalActions=false}) {

        if (schema === undefined) {
            schema = {};
        }
        if (schema.IntentAsChanges === undefined) {
            schema.IntentAsChanges = DefaultIntentAsChanges;
        }
        if (schema.updateDerivedState === undefined) {
            schema.updateDerivedState = doNothing;
        }

        const {IntentAsChanges, updateDerivedState} = schema;

        assert(typeof IntentAsChanges === `function`);
        this._IntentAsChanges = IntentAsChanges;

        assert(typeof updateDerivedState === `function`);
        this._updateDerivedState = updateDerivedState;

        assert(typeof handleChangeEvent === `function`);
        this._handleChangeEvent = handleChangeEvent;

        assert(typeof shouldRememberLocalActions === `boolean`);
        this._shouldRememberLocalActions = shouldRememberLocalActions;
        //^ remembering local actions is useful for implementing undo-redo

        this._stateMap = new Map();
        this.state = new CollabState(this._stateMap);
        this.derivedState = {};

        this._nextAction = Number.MIN_SAFE_INTEGER;
        this._actionIntents = new Map();
        this._actionChangeEvents = new Map();

    }

    do (intent) {

        let intentAsJson;
        try {
            intentAsJson = AsJson(intent);
        } catch (error) {
            rejectBadInput(error);
        }
        if (typeof intentAsJson !== `string`) {
            rejectBadInput(new AssertionError());
        }
        try {
            intent = FromJson(intentAsJson);
            //^ ensures that both the doer of the intent and others who receive 
            //  the intent as json will process the same thing in their 
            //  IntentAsChanges functions - in a perfect world this wouldn't be 
            //  necessary, but it's here because it makes it impossible to 
            //  introduce certain tricky-to-debug bugs
        } catch (error) {
            rejectBadInput(error);
        }

        const {changeEvents, action} = (
            this._writeIntentAndReturnItsInfo(intent, intentAsJson, false)
            );

        if (this._shouldRememberLocalActions) {

            this._actionIntents.set(action, intent);
            this._actionChangeEvents.set(action, changeEvents);

        }

        return action;

    }

    _writeIntentAndReturnItsInfo (intent, intentAsJson, isFromStorage) {

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
        let keyAsString;
        let valAsString;
        let key;
        let val;
        const partialChangeEvents = [];
        
        for (i=0; i<changeCount; i++) {
        //^ don't need to check if changeCount is Infinity because AsString 
        //  doesn't for undefined input, meaning the input will eventually be
        //  rejected

            c = changes[i]; // c contains [key, val]

            try {
                keyAsString = AsString(c[0]);
                valAsString = AsString(c[1]);
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

            key = FromString(keyAsString);
            val = FromString(valAsString);
            c[0] = key;
            c[1] = val;
            //^ ensures that both the doer of the intent and others who receive 
            //  the intent's changes will process the same key  and val in their 
            //  _writeChangeEventToState functions - in  a perfect world this 
            //  wouldn't be necessary, but it's   here because it makes it 
            //  impossible to introduce certain tricky-to-debug bugs

            partialChangeEvents[i] = {keyAsString, valAsString, key, val};

        }

        this._normalizeAndWritePartialChangeEventsToState(partialChangeEvents);

        return {
            changes, 
            changeEvents: partialChangeEvents, 
            //^ partialChangeEvents are now changeEvents because they've been 
            //  normalized
            action: this._nextAction++,
            };

    }

    _writeChangeEventToState (changeEvent) {

        if (changeEvent.valAsString === defaultValAsString) {

            this._stateMap.delete(changeEvent.keyAsString);

        }
        else {

            this._stateMap.set(changeEvent.keyAsString, changeEvent.val);

        }

        const state = this.state;
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
"use strict";

const assert = require(`./assert.js`);
const AssertionError = require(`./AssertionError.js`);
const CollabState = require(`./CollabState.js`);
const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const doNothing = require(`./doNothing.js`);
const firstVersion = require(`./firstVersion.js`);
const JsoAsJson = require(`./JsoAsJson.js`);
const JsoAsString = require(`./JsoAsString.js`);
const JsoFromJson = require(`./JsoFromJson.js`);
const JsoFromString = require(`./JsoFromString.js`);
const rejectBadInput = require(`./rejectBadInput.js`);

const DefaultIntentAsChanges = (intent, state, derivedState) => intent;

module.exports = class {

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

        this._currentVersion = firstVersion;

    }

    do (intent) {

        try {
            intent = JsoFromJson(JsoAsJson(intent));
            //^ ensures that both the doer of the intent and others who receive 
            //  the intent as json will process the same thing in their 
            //  IntentAsChanges functions - in a perfect world this wouldn't be 
            //  necessary, but it's here because it makes it impossible to 
            //  introduce certain tricky-to-debug bugs
        } catch (error) {
            rejectBadInput(error);
        }

        const {changeEvents, action} = this._writeIntentAndReturnItsInfo(intent);

        if (this._shouldRememberLocalActions) {

            this._actionIntents.set(action, intent);
            this._actionChangeEvents.set(action, changeEvents);

        }

        return action;

    }


    IntentOfAction (action) {
        return this._actionIntents.get(action);
    }

    ChangeEventsOfAction (action) {
        return this._actionChangeEvents.get(action);
    }

    _writeIntentAndReturnItsInfo (intent) {
        
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
        
        let i;
        let c;
        let keyAsString;
        let valAsString;
        let key;
        let val;
        const partialChangeEvents = [];
        
        for (i=0; i<changeCount; i++) {
        //^ don't need to check if changeCount is Infinity because JsoAsString 
        //  doesn't return a string for undefined input, meaning the input will 
        //  eventually berejected

            c = changes[i]; // c contains [key, val]

            try {
                keyAsString = JsoAsString(c[0]);
                valAsString = JsoAsString(c[1]);
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

            key = JsoFromString(keyAsString);
            val = JsoFromString(valAsString);
            c[0] = key;
            c[1] = val;
            //^ ensures that both the doer of the intent and others who receive 
            //  the intent's changes will process the same key  and val in their 
            //  _writeChangeEventToState functions - in  a perfect world this 
            //  wouldn't be necessary, but it's here because it makes it 
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
                e.oldValAsString = JsoAsString(storedVal);

            }

            this._writeChangeEventToState(e);

        }

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

    };
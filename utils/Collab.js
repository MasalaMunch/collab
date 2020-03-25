"use strict";

const AsJson = require(`./AsJson.js`);
const assert = require(`./assert.js`);
const AssertionError = require(`./AssertionError.js`);
const AsString = require(`./AsString.js`);
const MergedObjects = require(`./MergedObjects.js`);
const CollabState = require(`./CollabState.js`);
const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const doNothing = require(`./doNothing.js`);
const FromJson = require(`./FromJson.js`);
const FromString = require(`./FromString.js`);
const IsFromRejectBadInput = require(`./IsFromRejectBadInput.js`);
const rejectBadInput = require(`./rejectBadInput.js`);

const defaultConfig = {

    handleChangeEvent: doNothing,

    shouldRememberLocalActions: false,

    };

const defaultSchema = {

    IntentAsChanges: (intent, state, derivedState) => intent,

    updateDerivedState: doNothing,

    };

module.exports = class {

    constructor (config) {

        config = MergedObjects(defaultConfig, config);

        let {schema, handleChangeEvent, shouldRememberLocalActions} = config;

        schema = MergedObjects(defaultSchema, schema);

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

        this._keyAsStringVals = new Map();

        this._keyAsStringValsAsStrings = new Map();

        this.state = new CollabState(
            this._keyAsStringVals, this._keyAsStringValsAsStrings
            );

        this.derivedState = {};

        this._nextAction = 0;

        this._actionIntents = new Map();

        this._actionChangeEvents = new Map();

    }

    do (intent) {

        const intentAsString = AsString(intent);
        if (typeof intentAsString !== `string`) {
            throw new AssertionError();
        }

        intent = FromString(intentAsString);
        //^ ensures that both the doer of the intent and others who receive 
        //  the intent as a string will process the same thing in their 
        //  IntentAsChanges functions - in a perfect world this wouldn't be 
        //  necessary, but it's here because it makes it impossible to introduce 
        //  certain tricky-to-debug bugs

        let info;
        try {

            info = this._writeIntent(intent, intentAsString);

        } catch (error) {

            if (IsFromRejectBadInput(error)) {
                throw error.reason;
            }
            else {
                throw error;
            }

        }

        const action = info.action;

        if (this._shouldRememberLocalActions) {

            this._actionIntents.set(action, intent);

            const changeEvents = info.changeEvents;

            if (Array.isArray(changeEvents)) {

                this._actionChangeEvents.set(action, changeEvents);

            }
            else {

                const changeCount = changeEvents.length;
                const changeEventsAsArray = [];

                for (let i=0; i<changeCount; i++) {

                    changeEventsAsArray.push(changeEvents[i]);

                }

                this._actionChangeEvents.set(action, changeEventsAsArray);

            }

        }

        return action;

    }


    IntentOf (action) {
        return this._actionIntents.get(action);
    }

    ChangeEventsOf (action) {
        return this._actionChangeEvents.get(action);
    }

    _writeIntent (intent, intentAsString) {
        
        let changes;
        let changeCount;
        try {
            changes = this._IntentAsChanges(
                intent, this._state, this._derivedState
                );
            changeCount = changes.length;
        } catch (error) {
            rejectBadInput(error);
        }
        let i;
        let c;
        let keyAsString;
        let valAsString;
        const partialChangeEvents = changes;
        
        for (i=0; i<changeCount; i++) {

            c = changes[i];

            try {
                keyAsString = AsString(c.key);
                valAsString = AsString(c.val);
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

            partialChangeEvents[i] = {

                keyAsString,
                valAsString,

                key: FromString(keyAsString),
                val: FromString(valAsString),
                //^ ensures that both the doer of the intent and others who 
                //  receive the intent's changes will process the same key and 
                //  val in their _writeChangeEventToState functions - in  a 
                //  perfect world this wouldn't be necessary, but it's here 
                //  because it makes it impossible to introduce certain 
                //  tricky-to-debug bugs

                };

        }

        this._fillPartialChangeEventsAndWriteThemToState(partialChangeEvents);

        return {
            changeEvents: partialChangeEvents, 
            //^ partialChangeEvents are now changeEvents because they've been 
            //  filled by this._fillPartialChangeEventsAndWriteThemToState
            action: this._nextAction++,
            };

    }

    _fillPartialChangeEventsAndWriteThemToState (partialChangeEvents) {

        let i;
        const changeCount = partialChangeEvents.length;
        let e;
        let keyAsString;
        let storedVal;
        const keyAsStringVals = this._keyAsStringVals;
        const keyAsStringValsAsStrings = this._keyAsStringValsAsStrings;

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
                e.oldValAsString = keyAsStringValsAsStrings.get(keyAsString);

            }

            this._writeChangeEventToState(e);

        }

    }

    _writeChangeEventToState (changeEvent) {

        const keyAsString = changeEvent.keyAsString;
        const valAsString = changeEvent.valAsString;

        if (valAsString === defaultValAsString) {

            this._keyAsStringVals.delete(keyAsString);
            this._keyAsStringValsAsStrings.delete(keyAsString);

        }
        else {

            this._keyAsStringVals.set(keyAsString, changeEvent.val);
            this._keyAsStringValsAsStrings.set(keyAsString, valAsString);

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
        const allStringChanges = [];
        const allPartialChangeEvents = [];

        for (i=stringChangesArray.length-1; i>=0; i--) {

            stringChanges = stringChangesArray[i];

            for (j=stringChanges.length-1; j>=0; j--) {

                c = stringChanges[j]; // contains [keyAsString, valAsString]

                keyAsString = c[0];

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    valAsString = c[1];

                    if (valAsString !== defaultValAsString) {

                        allStringChanges.push(c);

                        allPartialChangeEvents.push({

                            keyAsString, 
                            valAsString, 

                            key: FromString(keyAsString),
                            val: FromString(valAsString),

                            });

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
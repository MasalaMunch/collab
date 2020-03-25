"use strict";

const AsString = require(`./AsString.js`);
const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const FromString = require(`./FromString.js`);

module.exports = class {

    constructor (keyAsStringVals, keyAsStringValsAsStrings) {

        this._keyAsStringVals = keyAsStringVals;
        this._keyAsStringValsAsStrings = keyAsStringValsAsStrings;

        this.AsString = AsString;
        this.FromString = FromString;

    }

    Size () {

        return this._keyAsStringVals.size;

    }

    KeysAsStrings () {

        return this._keyAsStringVals.keys();

    }

    *Keys () {

        for (const keyAsString of this._keyAsStringVals.keys()) {

            yield FromString(keyAsString);

        }
        
    }

    HasKeyAsString (keyAsString) {

        return this._keyAsStringVals.has(keyAsString);
    }

    Has (key) {

        return this._keyAsStringVals.has(AsString(key));

    }

    ValOfKeyAsString (keyAsString) {

        const storedVal = this._keyAsStringVals.get(keyAsString);

        return (storedVal === undefined)? defaultVal : storedVal;   

    }

    ValOf (key) {

        const storedVal = this._keyAsStringVals.get(AsString(key));

        return (storedVal === undefined)? defaultVal : storedVal;

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const storedValAsString = 
            this._keyAsStringValsAsStrings.get(keyAsString);

        return (storedValAsString === undefined)? 
            defaultValAsString : storedValAsString;   

    }

    ValAsStringOf (key) {

        const storedValAsString = 
            this._keyAsStringValsAsStrings.get(AsString(key));

        return (storedValAsString === undefined)? 
            defaultValAsString : storedValAsString;

    }

    };
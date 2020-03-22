"use strict";

module.exports = class {

    constructor (keyAsStringVals, keyAsStringValAsStrings, KeyAsString, 
                 KeyFromString, ValAsString, ValFromString, defaultVal, 
                 defaultValAsString) {

        this._keyAsStringVals = keyAsStringVals;
        this._keyAsStringValAsStrings = keyAsStringValAsStrings;

        this.KeyAsString = KeyAsString;
        this.KeyFromString = KeyFromString;
        this.ValAsString = ValAsString;
        this.ValFromString = ValFromString;
        this.defaultVal = defaultVal;
        this.defaultValAsString = defaultValAsString;

    }

    Size () {

        return this._keyAsStringVals.size;

    }

    KeysAsStrings () {

        return this._keyAsStringVals.keys();

    }

    *Keys () {

        const KeyFromString = this.KeyFromString;

        for (const keyAsString of this._keyAsStringVals.keys()) {

            yield KeyFromString(keyAsString);

        }
        
    }

    HasKeyAsString (keyAsString) {

        return this._keyAsStringVals.has(keyAsString);
    }

    Has (key) {

        return this._keyAsStringVals.has(this.KeyAsString(key));

    }

    ValOfKeyAsString (keyAsString) {

        const storedVal = this._keyAsStringVals.get(keyAsString);

        return (storedVal === undefined)? this.defaultVal : storedVal;   

    }

    ValOf (key) {

        const storedVal = this._keyAsStringVals.get(this.KeyAsString(key));

        return (storedVal === undefined)? this.defaultVal : storedVal;

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const storedValAsString = 
            this._keyAsStringValAsStrings.get(keyAsString);

        return (storedValAsString === undefined)? 
            this.defaultValAsString : storedValAsString;   

    }

    ValAsStringOf (key) {

        const storedValAsString = 
            this._keyAsStringValAsStrings.get(this.KeyAsString(key));

        return (storedValAsString === undefined)? 
            this.defaultValAsString : storedValAsString;

    }

    };
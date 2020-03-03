"use strict";

module.exports = class {

    constructor (KeyAsString, KeyFromString, ValAsString, ValFromString, 
                 defaultVal, defaultValAsString) {

        this._map = new Map();
        this.KeyAsString = KeyAsString;
        this.KeyFromString = KeyFromString;
        this.ValAsString = ValAsString;
        this.ValFromString = ValFromString;
        this.defaultVal = defaultVal;
        this.defaultValAsString = defaultValAsString;

    }

    HasKeyAsString (keyAsString) {
        return this._map.has(keyAsString);
    }

    Has (key) {
        return this.HasKeyAsString(this.KeyAsString(key));
    }

    ValOf (key) {
        return this.ValOfKeyAsString(this.KeyAsString(key));
        //^ ValOfKeyAsString should be implemented in a child class
    }

    ValAsStringOf (key) {
        return this.ValAsStringOfKeyAsString(this.KeyAsString(key));
        //^ ValAsStringOfKeyAsString should be implemented in a child class
    }

    KeysAsStrings () {
        return this._map.keys();
    }

    *Keys () {
        for (const keyAsString of this.KeysAsStrings()) {
            yield this.KeyFromString(keyAsString);
        }
    }

    Size () {
        return this._map.size;
    }

};
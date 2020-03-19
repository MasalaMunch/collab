"use strict";

const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const JsoAsString = require(`./JsoAsString.js`);
const JsoFromString = require(`./JsoFromString.js`);

module.exports = class {

    constructor (map) {

        this._map = map;

    }

    Size () {

        return this._map.size;

    }

    KeysAsStrings () {

        return this._map.keys();

    }

    *Keys () {

        for (const keyAsString of this._map.keys()) {
            yield JsoFromString(keyAsString);
        }
        
    }

    HasKeyAsString (keyAsString) {

        return this._map.has(keyAsString);
    }

    Has (key) {

        return this._map.has(JsoAsString(key));

    }

    ValOfKeyAsString (keyAsString) {

        const storedVal = this._map.get(keyAsString);

        return (storedVal === undefined)? 
            defaultVal : storedVal;   

    }

    ValOf (key) {

        const storedVal = this._map.get(JsoAsString(key));

        return (storedVal === undefined)? 
            defaultVal : storedVal;

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const storedVal = this._map.get(keyAsString);

        return (storedVal === undefined)? 
            defaultValAsString : JsoAsString(storedVal); 

    }

    ValAsStringOf (key) {

        const storedVal = this._map.get(JsoAsString(keyAsString));

        return (storedVal === undefined)? 
            defaultValAsString : JsoAsString(storedVal); 

    }

    };

module.exports.AsString = JsoAsString;

module.exports.FromString = JsoFromString;
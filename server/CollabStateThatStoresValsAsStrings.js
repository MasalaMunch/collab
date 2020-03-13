"use strict";

const {CollabStateBase} = require(`@masalamunch/collab-utils`);

module.exports = class extends CollabStateBase {

    ValOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultVal : this.ValFromString(valAsString)
            );

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultValAsString : valAsString
            );

    }

    _writeChangeEvent (changeEvent) {

        if (changeEvent.valAsString === this.defaultValAsString) {
            this._map.delete(changeEvent.keyAsString);
        }
        else {
            this._map.set(changeEvent.keyAsString, changeEvent.valAsString);
        }

    }

};

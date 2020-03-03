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

    _writeChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.valAsString);
        }

    }

};

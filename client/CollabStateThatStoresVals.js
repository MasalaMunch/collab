"use strict";

const {CollabStateBase} = require(`@masalamunch/collab-utils`);

module.exports = class extends CollabStateBase {

    ValOfKeyAsString (keyAsString) {

        const val = this._map.get(keyAsString);
        return (
            val === undefined? 
            this.defaultVal : val
            );

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const val = this._map.get(keyAsString);
        return (
            val === undefined? 
            this.defaultValAsString : this.ValAsString(val)
            );

    }

    _writeChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.val);
        }

    }

};
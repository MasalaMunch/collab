import assert from "assert";

import defIn from "@masalamunch/def-in";
import ClassFactory from "@masalamunch/class-factory";
import {BaseCollab, BaseCollabMap, firstVersion} from "@masalamunch/collab-base";


const ClientCollabMap = class extends BaseCollabMap {

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

    _handleChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.val);
        }

    }

};


const ClientCollab = class extends BaseCollab {

    constructor (config) {

        defIn(config, {CollabMap: ClientCollabMap});
        super(config);

        const {handleChange, ReversedTransaction} = config;

        if (handleChange) {
            assert(handleChange instanceof Function);
            this._changeHandlers.push(handleChange);
        }

        if (ReversedTransaction) {
            assert(ReversedTransaction instanceof Function);
            this._ReversedTransaction = ReversedTransaction;
        }

        this._keyAsStringVersions = new Map();

        this._readStorage();


    }

    do (transaction) {



    }

    undo () {



    }

    redo () {



    }

    startSync () {



    }

    finishSync (serverOutput) {



    }

    cancelSync () {



    }

};


const ClientCollabClassInterface = class {

    constructor (coreConfig) {
        this._coreConfig = coreConfig;
    }

    Client (clientConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assert(config, clientConfig);
        return new ClientCollab(config);
    }

};


export default ClassFactory(ClientCollabClassInterface);
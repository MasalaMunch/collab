"use strict";

const Queue = class {

    constructor () {
        this._firstNode = undefined;
        this._lastNode = undefined;
    }

    IsEmpty () {
        return this._firstNode === undefined;
    }

    OldestItem () {
        return this._firstNode[0];
    }

    add (item) {

        const node = [item, undefined];

        if (this._lastNode === undefined) {

            this._lastNode = node;
            this._firstNode = node;

        }
        else {

            this._lastNode[1] = node;
            this._lastNode = node;

        }

    }

    deleteOldestItem () { 

        this._firstNode = this._firstNode[1];

        if (this._firstNode === undefined) {

            this._lastNode = undefined;
            
        }

    }

};

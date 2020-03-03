"use strict";

const Queue = class {

    constructor () {
        this._firstNode = undefined;
        this._lastNode = undefined;
    }

    IsEmpty () {
        return this._firstNode === undefined;
    }

    FirstItem () {
        return this._firstNode.item;
    }

    append (item) {

        const node = {item};

        if (this._lastNode === undefined) {

            this._lastNode = node;
            this._firstNode = node;

        }
        else {

            this._lastNode.nextNode = node;
            this._lastNode = node;

        }

    }

    deleteFirstItem (item) { 

        this._firstNode = this._firstNode.nextNode;

        if (this._firstNode === undefined) {

            this._lastNode = undefined;
            
        }

    }

};

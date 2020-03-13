"use strict";

const {assert, sharedCollabConfigProps} = require(`@masalamunch/collab-utils`);

const CollabClient = require(`./CollabClient.js`);

module.exports = class {

    constructor (collabConfig) {

        this._collabConfig = collabConfig;
        
    }

    Client (collabClientConfig) {

        for (const prop in collabClientConfig) {
            assert(!sharedCollabConfigProps.has(prop));
        }

        const config = {};
        Object.assign(config, this._collabConfig);
        Object.assign(config, collabClientConfig);

        return new CollabClient(config);

    }

};
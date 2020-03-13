"use strict";

const CollabClient = require(`./CollabClient.js`);

module.exports = class {

    constructor (collabConfig) {

        this._collabConfig = collabConfig;
        
    }

    Client (collabClientConfig) {

        const config = {};

        Object.assign(config, collabClientConfig);
        Object.assign(config, this._collabConfig);

        return new CollabClient(config);

    }

};
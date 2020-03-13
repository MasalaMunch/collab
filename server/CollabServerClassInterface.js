"use strict";

const CollabServer = require(`./CollabServer.js`);

module.exports = class {

    constructor (collabConfig) {

        this._collabConfig = collabConfig;
        
    }

    Server (collabServerConfig) {

        const config = {};

        Object.assign(config, collabServerConfig);
        Object.assign(config, this._collabConfig);

        return new CollabServer(config);

    }

};
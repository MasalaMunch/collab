"use strict";

const CollabServer = require(`./CollabServer.js`);

module.exports = class {

    constructor (collabConfig) {

        this._collabConfig = collabConfig;
        
    }

    Server (collabServerConfig) {

        const config = {};

        Object.assign(config, this._collabConfig);
        Object.assign(config, collabServerConfig);

        return new CollabServer(config);

    }

};
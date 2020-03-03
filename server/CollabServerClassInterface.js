"use strict";

const CollabServer = require(`./CollabServer.js`);

module.exports = class {

    constructor (baseConfig) {
        this._baseConfig = baseConfig;
    }

    Server (serverConfig) {
        const config = {};
        Object.assign(config, this._baseConfig);
        Object.assign(config, serverConfig);
        return new CollabServer(config);
    }

};
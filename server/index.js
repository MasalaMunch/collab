"use strict";

const {ClassFactory, assert, sharedCollabConfigProps} 
    = require(`@masalamunch/collab-utils`);

const CollabServer = require(`./CollabServer.js`);

module.exports = ClassFactory(class {

    constructor (collabConfig) {

        this._collabConfig = collabConfig;
        
    }

    Server (collabServerConfig) {

        for (const prop in collabServerConfig) {
            assert(!sharedCollabConfigProps.has(prop));
        }

        const config = {};
        Object.assign(config, this._collabConfig);
        Object.assign(config, collabServerConfig);

        return new CollabServer(config);

    }

});

//^ const Collab = require(`collab-server`);
//  const collabServer = Collab().Server();
"use strict";

const {minCollabServerId} = require(`@masalamunch/collab-utils`);

module.exports = () => minCollabServerId + Math.random();
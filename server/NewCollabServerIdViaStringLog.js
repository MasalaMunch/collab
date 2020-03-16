"use strict";

const {minCollabServerId} = require(`@masalamunch/collab-utils`);

module.exports = ({stringLog}) => {

    const oldId = Number(stringLog.Entries()[0]);

    const newId = isNaN(oldId)? minCollabServerId : oldId+1;

    stringLog.overwrite(newId);

    return newId;

};
"use strict";

const {minCollabServerId, StoredStringLog} = require(`@masalamunch/collab-utils`);

module.exports = ({path}) => {

    const storedStringLog = new StoredStringLog({path, delimiter: `\n`});

    const oldId = Number(storedStringLog.Entries()[0]);

    const newId = isNaN(oldId)? minCollabServerId : oldId+1;

    storedStringLog.overwrite(newId);

    return newId;

};
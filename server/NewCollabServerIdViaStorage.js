"use strict";

const {minCollabServerId, StoredStringLog} = require(`@masalamunch/collab-utils`);

const numberAsStringSeparator = require(`./numberAsStringSeparator.js`);

module.exports = ({path}) => {

    const idAsStringLog = new StoredStringLog({
        path, 
        separator: numberAsStringSeparator,
        });

    const oldId = Number(idAsStringLog.Entries()[0]);

    const newId = isNaN(oldId)? minCollabServerId : oldId+1;

    idAsStringLog.clear();
    idAsStringLog.write(String(newId));

    return newId;

    };
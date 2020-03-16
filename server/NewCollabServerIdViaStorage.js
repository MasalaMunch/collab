"use strict";

const {minCollabServerId, StoredNumberValue} = require(`@masalamunch/collab-utils`);

module.exports = ({path}) => {

    const storedId = new StoredNumberValue({path});

    const oldId = storedId.Contents();

    const newId = isNaN(oldId)? minCollabServerId : oldId+1;

    storedId.write(newId);

    return newId;

};
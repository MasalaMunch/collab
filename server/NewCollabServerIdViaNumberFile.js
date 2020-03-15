"use strict";

const fs = require(`fs`);

const {minCollabServerId, stringFileEncoding} 
    = require(`@masalamunch/collab-utils`);

const stringFileOptions = {encoding: stringFileEncoding};

module.exports = ({path}) => {

    let newId;

    try {

        newId = 1 + Number(fs.readFileSync(path, stringFileOptions));

    } catch (error) {

        if (error.code === `ENOENT`) { // if path doesn't exist
            newId = minCollabServerId;
        }
        else {
            throw error;
        }

    }

    fs.writeFileSync(path, String(newId), stringFileOptions);

    return newId;

};
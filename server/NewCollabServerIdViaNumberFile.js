"use strict";

const fs = require(`fs`);

const {minCollabServerId, stringFileEncoding} 
    = require(`@masalamunch/collab-utils`);

const stringFileOptions = {encoding: stringFileEncoding};

module.exports = (file) => {

    let newId;

    try {

        newId = 1 + Number(fs.readFileSync(file, stringFileOptions));

    } catch (error) {

        if (error.code === `ENOENT`) { // if file doesn't exist
            newId = minCollabServerId;
        }
        else {
            throw error;
        }

    }

    fs.writeFileSync(file, String(newId), stringFileOptions);

    return newId;

};
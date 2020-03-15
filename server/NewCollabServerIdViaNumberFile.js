"use strict";

const fs = require(`fs`);

const {minCollabServerId} = require(`@masalamunch/collab-utils`);

const fileOptions = {encoding: `utf8`};

module.exports = (file) => {

    let newId;

    try {

        newId = 1 + Number(fs.readFileSync(file, fileOptions));

    } catch (error) {

        if (error.code === `ENOENT`) { // if file doesn't exist
            newId = minCollabServerId;
        }
        else {
            throw error;
        }

    }

    fs.writeFileSync(file, String(newId), fileOptions);

    return newId;

};
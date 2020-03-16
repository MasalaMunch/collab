"use strict";

const fs = require(`fs`);

const {minCollabServerId} = require(`@masalamunch/collab-utils`);

const stringFileEncoding = require(`./stringFileEncoding.js`);

module.exports = ({path}) => {

    let newId;

    try {

        newId = 1 + Number(fs.readFileSync(path, {encoding: stringFileEncoding}));

    } catch (error) {

        if (error.code === `ENOENT`) {
            newId = minCollabServerId;
        }
        else {
            throw error;
        }

    }

    fs.writeFileSync(path, String(newId), {encoding: stringFileEncoding});

    return newId;

};
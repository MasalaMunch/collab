"use strict";

const fs = require(`fs`);

const {stringFileEncoding} = require(`@masalamunch/collab-utils`);

module.exports = class {

    constructor ({path, delimiter}) {

        this._path = path;

        this._appendStream = fs.createWriteStream(
            this._path, 
            {encoding: stringFileEncoding, flags: `a`},
            );

        this._delimiter = delimiter;

        let fileAsString;

        try {

            fileAsString = fs.readFileSync(
                this._path, 
                {encoding: stringFileEncoding},
                );

        } 
        catch (error) {

            if (error.code === `ENOENT`) {
                fileAsString = ``;
            }
            else {
                throw error;
            }

        }

        this._oldEntries = fileAsString.split(this._delimiter).slice(0, -1);

        fs.writeFileSync(this._path, ``, {encoding: stringFileEncoding});

    }

    OldEntries () {

        return this._oldEntries;

    }

    deleteOldEntries () {

        this._oldEntries = undefined;

    }

    addToWriteQueue (string) {

        const s = this._appendStream;

        s.write(string);
        s.write(this._delimiter);

    }

    };
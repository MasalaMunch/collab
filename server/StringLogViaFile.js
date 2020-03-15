"use strict";

const fs = require(`fs`);

const encoding = `utf8`;

module.exports = class {

    constructor ({path, delimiter}) {

        this._path = path;

        this._appendStream = fs.createWriteStream(
            this._path, 
            {encoding, flags: `a`},
            );

        this._delimiter = delimiter;

        let entriesAsString;

        try {

            entriesAsString = fs.readFileSync(this._path, {encoding});

        } 
        catch (error) {

            if (error.code === `ENOENT`) {
                entriesAsString = ``;
            }
            else {
                throw error;
            }

        }

        this._oldEntries = entriesAsString.split(this._delimiter).slice(0, -1);
        
        fs.writeFileSync(this._path, ``, {encoding});

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
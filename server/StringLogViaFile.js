"use strict";

const fs = require(`fs`);

const stringFileEncoding = require(`./stringFileEncoding.js`);

module.exports = class {

    constructor ({path, delimiter}) {

        this._path = path;
        this._delimiter = delimiter;

        this._appendStream = undefined;

    }

    Entries () {

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

        const entries = fileAsString.split(this._delimiter);

        entries.pop();

        return entries;

    }

    clear () {

        fs.writeFileSync(this._path, ``, {encoding: stringFileEncoding});

    }

    initializeWriteQueue () {

        this._appendStream = fs.createWriteStream(
            this._path, 
            {encoding: stringFileEncoding, flags: `a`},
            );

    }

    addToWriteQueue (entry) {

        const s = this._appendStream;

        s.write(entry);
        s.write(this._delimiter);

    }

    };
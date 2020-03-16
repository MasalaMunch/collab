"use strict";

const fs = require(`fs`);

const stringFileEncoding = require(`./stringFileEncoding.js`);

const fileOptions = {encoding: stringFileEncoding};

module.exports = class {

    constructor ({path, delimiter}) {

        this._path = path;
        this._delimiter = delimiter;
        this._appendStream = undefined;

    }

    Entries () {

        let fileAsString;

        try {

            fileAsString = fs.readFileSync(this._path, fileOptions);

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

        fs.writeFileSync(this._path, ``, fileOptions);

    }

    overwrite (entry) {

        fs.writeFileSync(this._path, entry+this._delimiter, fileOptions);

    }

    initializeWriteQueue () {

        const streamOptions = {};

        Object.assign(streamOptions, fileOptions);

        streamOptions.flags = `a`;

        this._appendStream = fs.createWriteStream(this._path, streamOptions);

    }

    addToWriteQueue (entry) {

        const s = this._appendStream;
        s.write(entry);
        s.write(this._delimiter);

    }

    };
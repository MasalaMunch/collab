"use strict";

const fs = require(`fs`);

const AssertionError = require(`./AssertionError.js`);
const stringFileEncoding = require(`./stringFileEncoding.js`);

module.exports = class {

    static IsSupported () {

        return (
            fs 
            && typeof fs.readFileSync === `function`
            && typeof fs.writeFileSync === `function`
            && typeof fs.createWriteStream === `function`
            );

    }

    constructor ({path, separator}) {

        this._path = path;

        assert(typeof separator === `string`);
        this._separator = separator;

        this._appendStream = fs.createWriteStream(
            this._path, 
            {flags: `a`, encoding: stringFileEncoding},
            );

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

        const entries = fileAsString.split(this._separator);

        entries.pop();

        return entries;

    }

    clear () {

        fs.writeFileSync(this._path, ``, {encoding: stringFileEncoding});

    }

    addToWriteQueue (entry) {

        if (typeof entry !== `string`) {
            throw new AssertionError();
        }

        const s = this._appendStream;

        s.write(entry);
        s.write(this._separator);

    }

    };
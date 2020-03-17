"use strict";

const fs = require(`fs`);

const AssertionError = require(`./AssertionError.js`);
const stringFileEncoding = require(`./stringFileEncoding.js`);

const fileOptions = {encoding: stringFileEncoding};

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

        const entries = fileAsString.split(this._separator);

        entries.pop();

        return entries;

    }

    clear () {

        fs.writeFileSync(this._path, ``, fileOptions);

    }

    write (entry) {

        assert(typeof entry === `string`);

        fs.appendFileSync(this._path, entry+this._separator, fileOptions);

    }

    initializeWriteQueue () {

        const streamOptions = {};

        Object.assign(streamOptions, fileOptions);

        streamOptions.flags = `a`;

        this._appendStream = fs.createWriteStream(this._path, streamOptions);

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
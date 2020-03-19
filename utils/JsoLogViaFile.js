"use strict";

const fs = require(`fs`);

const AssertionError = require(`./AssertionError.js`);
const JsoFromJson = require(`./JsoFromJson.js`);

const encoding = `utf8`;
const separator = `\n`;

module.exports = class {

    static IsSupported () {

        return (
            fs 
            && typeof fs.readFileSync === `function`
            && typeof fs.writeFileSync === `function`
            && typeof fs.createWriteStream === `function`
            );

    }

    constructor ({path}) {

        this._path = path;

        this._appendStream = fs.createWriteStream(
            this._path, {encoding, flags: `a`}
            );

    }

    Entries () {

        let fileAsString;

        try {

            fileAsString = fs.readFileSync(this._path, {encoding});

        } 
        catch (error) {

            if (error.code === `ENOENT`) {
                fileAsString = ``;
            }
            else {
                throw error;
            }

        }

        const entriesAsJson = fileAsString.split(separator);

        entriesAsJson.pop();

        let i;
        const entryCount = entriesAsJson.length;
        const entries = entriesAsJson;

        for (i=0; i<entryCount; i++) {

            entries[i] = JsoFromJson(entriesAsJson[i]);

        }

        return entries;

    }

    clear () {

        fs.writeFileSync(this._path, ``, {encoding});

    }

    addJsonToWriteQueue (entryAsJson) {

        const s = this._appendStream;

        s.write(entryAsJson);
        s.write(separator);

    }

    };
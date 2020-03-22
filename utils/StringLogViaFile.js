"use strict";

const fs = require(`fs`);

const encoding = `utf8`;

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

        this._separator = separator;

        this._appendStream = 
            fs.createWriteStream(this._path, {encoding, flags: `a`});

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

        const entries = fileAsString.split(this._separator);

        entries.pop();

        return entries;

    }

    clear () {

        fs.writeFileSync(this._path, ``, {encoding});

    }

    addToWriteQueue (entry) {

        const s = this._appendStream;

        s.write(entry);
        s.write(this._separator);

    }

    };
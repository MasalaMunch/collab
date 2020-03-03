"use strict";

const fs = require(`fs`);
const JoinedPaths = require(`path`).join;

const exitProcessDueToAnError = () => process.exit(1);

const JSONstringify = JSON.stringify;

const separatorChar = `\n`;

const encoding = `utf8`;

module.exports = class {

    constructor ({path, defaultValAsString}) {

        this._logFilePath = JoinedPaths(path, `log`);

        this._logFileAppendStream = fs.createWriteStream(
            this._logFilePath, {flags: `a`, encoding}
            );
        this._logFileAppendStream.on(`error`, exitProcessDueToAnError);

        this._defaultValAsString = defaultValAsString;

    }

    Changes () {

        const logStrings = (
            fs.readFileSync(this._logFilePath, {encoding})
            .split(separatorChar)
            );

        const overwrittenKeysAsStrings = new Set();

        const changesAsArrays = [];

        for (let i=logStrings.length-2; i>=0; i--) {
        //^ -2 instead of -1 because the last line should be blank

            const log = JSON.parse(logStrings[i]);

            for (let j=log.length-1; j>=0; j--) {

                const changeAsArray = log[j];
                const [keyAsString, valAsString] = changeAsArray;

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    if (valAsString !== this._defaultValAsString) {

                        changesAsArrays.push(changeAsArray);

                    }

                }

            }
            //^ filter out changes that
            //      are overwritten by a later change
            //      are deletions (valAsString === defaultValAsString)

        }

        fs.writeFileSync(
            this._logFilePath, 
            JSON.stringify(changesAsArrays) + separatorChar,
            {encoding},
            );

        return changesAsArrays.map(
            ([keyAsString, valAsString]) => ({keyAsString, valAsString})
            );

        //^ these changes can be written and returned in the opposite order 
        //  they happened only because they contain no overwritten changes

    }

    atomicallyAddChangesToWriteQueue (changes) {

        let i;
        const changeCount = changes.length;
        let c;
        const changesAsArrays = new Array(changes.length);

        for (i=0; i<changeCount; i++) {

            c = changes[i];
            changesAsArrays[i] = [c.keyAsString, c.valAsString];

        }

        const logFileAppendStream = this._logFileAppendStream;
        logFileAppendStream.write(JSONstringify(changesAsArrays));
        logFileAppendStream.write(separatorChar);

    }

};

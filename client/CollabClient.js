"use strict";

const {assert, Collab, Queue} = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresVals = require(`./CollabStateThatStoresVals.js`);

module.exports = class extends Collab {

    constructor (config) {

        config.CollabState = CollabStateThatStoresVals;

        super(config);

        const {localStoragePrefix} = config;

        this._serverId = 1; // i.e. undefined since serverIds fall within [0,1)

        this._currentVersion = 0; // i.e. undefined since serverId is undefined

        //TODO figure out storage abstractions (use stream concept!), then read them here (replace the
        //     server code that's currently here)

        if (localStoragePrefix === undefined) {

            this._logFileAppendStream = new stream.PassThrough();

        }
        else {

            const logFilePath = path.join(localStoragePrefix, `log`);

            this._logFileAppendStream = fs.createWriteStream(
                logFilePath, 
                {flags: `a`, encoding: logFileEncoding},
                );

            const stringChanges = (
                fs.readFileSync(logFilePath, {encoding: logFileEncoding})
                .split(logFileSeparatorChar)
                .slice(0, -1) // remove the last item
                .map(FromJson)
                .flat()
                );

            const compressedStringChanges = [];

            const overwrittenKeysAsStrings = new Set();

            for (let i=stringChanges.length-1; i>=0; i--) {

                const c = stringChanges[i];
                const [keyAsString, valAsString] = c;

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    if (valAsString !== this._defaultValAsString) {

                        compressedStringChanges.push(c);

                    }

                }

            }
            //^ filter out changes that:
            //
            //      are overwritten by a later change
            //      are deletions (valAsString === defaultValAsString)
            //
            //  (the remaining changes can be represented in the opposite order 
            //   they happened because they contain no overwritten changes)

            fs.writeFileSync(
                logFilePath, 
                AsJson(compressedStringChanges) + logFileSeparatorChar,
                {encoding: logFileEncoding},
                );

            for (let i=0; i<compressedStringChanges.length; i++) {

                this._writeChangeEventToState(
                    this._StringChangeAsChangeEvent(compressedStringChanges[i])
                    );

            }

        }

    }

    _writeIntentAndReturnItsInfo (intent, intentAsString, isFromStorage) {

        const info = super._writeIntentAndReturnItsInfo(
            intent, intentAsString, isFromStorage
            );
        const changeEvents = info.changeEvents;

        //TODO write intent to in-memory buffer and storage buffer stream if not 
        //     from storage

        return info;

    }

    startSync () {



    }

    finishSync (serverOutput) {

        //TODO write all these changes atomically to storage stream

    }

    cancelSync () {



    }

};

const CollabClientClassInterface = class {

    constructor (coreConfig) {
        this._coreConfig = coreConfig;
    }

    Client (clientConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assign(config, clientConfig);
        return new CollabClient(config);
    }

};

module.exports = ClassFactory(CollabClientClassInterface);
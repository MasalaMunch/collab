"use strict";

const fs = require(`fs`);

const {RBTree: RbTree} = require(`bintrees`);

const {assert, CollabBase, CollabMapThatStoresValsAsStrings, firstVersion, 
       ClassFactory} = require(`@masalamunch/collab-utils`);

const JSONstringify = JSON.stringify;

const exitProcessDueToAnError = () => process.exit(1);

const storageSeparatorChar = `\n`;
const storageEncoding = `utf8`;

const CollabStorageViaLogFile = class {

    constructor ({path, defaultValAsString}) {

        this._logFilePath = path;
        this._defaultValAsString = defaultValAsString;

        this._logFileAppendStream = fs.createWriteStream(
            this._logFilePath, 
            {flags: `a`, encoding: storageEncoding},
            );
        this._logFileAppendStream.on(`error`, exitProcessDueToAnError);

    }

    AllChanges () {

        const logStrings = (
            fs.readFileSync(this._logFilePath, {encoding: storageEncoding})
            .split(storageSeparatorChar)
            );

        const overwrittenKeysAsStrings = new Set();

        const compressedLog = [];

        for (let i=logStrings.length-2; i>=0; i--) {
        //^ -2 instead of -1 because the last line should be blank

            const log = JSON.parse(logStrings[i]);

            for (let j=log.length-1; j>=0; j--) {

                const change = log[j];
                const [keyAsString, valAsString] = change;

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    if (valAsString !== this._defaultValAsString) {

                        compressedLog.push(change);

                    }

                }

            }
            //^ filter out changes that
            //      are overwritten by a later change
            //      are deletions (valAsString === defaultValAsString)

        }

        fs.writeFileSync(
            this._logFilePath, 
            JSON.stringify(compressedLog),
            {encoding: storageEncoding},
            );
        fs.appendFileSync(
            this._logFilePath, 
            storageSeparatorChar,
            {encoding: storageEncoding},
            );

        return compressedLog.map(
            [keyAsString, valAsString] => ({keyAsString, valAsString})
            );

        //^ compressed changes can be written and returned in the opposite order 
        //  they happened because they contain no overwritten changes

    }

    addAtomizedChangesToWriteQueue (changes) {

        let i;
        const changeCount = changes.length;
        let c;
        const writeThisAsJson = new Array(changes.length);

        for (i=0; i<changeCount; i++) {

            c = changes[i];
            writeThisAsJson[i] = [c.keyAsString, c.valAsString];
            
        }

        const logFileAppendStream = this._logFileAppendStream;
        logFileAppendStream.write(JSONstringify(writeThisAsJson));
        logFileAppendStream.write(storageSeparatorChar);

    }

};

const VersionComparison = (a, b) => a - b;

const CollabServer = class extends CollabBase {

    constructor (config) {

        if (config.CollabMap === undefined) {
            config.CollabMap = CollabMapThatStoresValsAsStrings;
        }

        if (config.CollabStorage === undefined) {
            config.CollabStorage = CollabStorageViaLogFile;
        }

        super(config);

        this._keyAsStringVersions = new Map();
        this._versionKeysAsStrings = new Map();
        this._versionTree = new RbTree(VersionComparison);
        this._deletedVersionTree = new RbTree(VersionComparison);

        this._readStorage();

    }


    sync (clientInput) {



    }

    _handleChange (change) {

        super._handleChange(change);

        const oldVersion = this._keyAsStringVersions.get(change.keyAsString);

        if (oldVersion !== undefined) {

            this._versionKeysAsStrings.delete(oldVersion);

            if (change.oldValAsString === this._defaultValAsString) {

                this._deletedVersionTree.remove(oldVersion);

            }
            else {

                this._versionTree.remove(oldVersion);

            }

        }

        this._keyAsStringVersions.set(change.keyAsString, NEWVERSION);
        this._versionKeysAsStrings.set(NEWVERSION, change.keyAsString);

        if (change.valAsString === this._defaultValAsString) {

            this._deletedVersionTree.insert(change._version);

        }
        else {

            this._versionTree.insert(change._version);

        }

    }

};

const CollabServerClassInterface = class {

    constructor (baseConfig) {
        this._coreConfig = baseConfig;
    }

    Server (serverConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assign(config, serverConfig);
        return new CollabServer(config);
    }

};

module.exports = ClassFactory(CollabServerClassInterface);
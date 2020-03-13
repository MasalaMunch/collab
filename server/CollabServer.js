"use strict";

const fs = require(`fs`);
const JoinedPaths = require(`path`).join;
const fakeStream = new require(`stream`).PassThrough();

const RbTree = require(`bintrees`).RBTree;

const {assert, Collab, rejectBadInput, AsJson, FromJson} 
    = require(`@masalamunch/collab-utils`);

const CollabStateThatStoresValsAsStrings 
    = require(`./CollabStateThatStoresValsAsStrings.js`);

const logFileEncoding = `utf8`;
const logFileSeparatorChar = `\n`;
const idFileEncoding = `utf8`;

const VersionComparison = (a, b) => a - b;

const firstVersion = 0;

module.exports = class extends Collab {

    constructor (config) {

        config.CollabState = CollabStateThatStoresValsAsStrings;

        super(config);

        const {storagePath} = config;

        this._keyAsStringVersions = new Map();
        this._versionKeysAsStrings = new Map();

        this._versionTree = new RbTree(VersionComparison);
        this._deletionVersionTree = new RbTree(VersionComparison);

        this._currentVersion = firstVersion;

        if (storagePath === undefined) {

            this._logFileAppendStream = fakeStream;
            this._id = 1 + Math.random();

        }
        else {

            const logFilePath = JoinedPaths(storagePath, `log`);

            this._logFileAppendStream = fs.createWriteStream(
                logFilePath, 
                {flags: `a`, encoding: logFileEncoding},
                );

            const idFilePath = JoinedPaths(storagePath, `id`);

            try {

                this._id = 1 + Number(fs.readFileSync(
                    idFilePath, 
                    {encoding: idFileEncoding},
                    ));

            } catch (error) {

                if (error.code === `ENOENT`) { // if file doesn't exist
                    this._id = 1;
                }
                else {
                    throw error;
                }

            }

            fs.writeFileSync(
                idFilePath, 
                String(this._id), 
                {encoding: idFileEncoding},
                );

            const stringChanges = (
                fs.readFileSync(logFilePath, {encoding: logFileEncoding})
                .split(logFileSeparatorChar)
                .slice(0, -1) // remove the last item
                .map(FromJson)
                .flat()
                );

            const overwrittenKeysAsStrings = new Set();

            const compressedStringChanges = [];

            for (let i=stringChanges.length-1; i>=0; i--) {

                const c = stringChanges[i];
                const [keyAsString, valAsString] = c;

                if (!overwrittenKeysAsStrings.has(keyAsString)) {

                    overwrittenKeysAsStrings.add(keyAsString);

                    if (valAsString !== this._defaultValAsString) {

                        compressedStringChanges.push(c);
                        
                        this._writeChangeEventToState(
                            this._StringChangeAsChangeEvent(c)
                            );

                    }

                }

            }
            //^ filter out changes that:
            //
            //      are overwritten by a later change
            //      are deletions (valAsString === defaultValAsString)
            //
            //  (the remaining changes can be written in the opposite order 
            //   they happened because they contain no overwritten changes)

            fs.writeFileSync(
                logFilePath, 
                AsJson(compressedStringChanges) + logFileSeparatorChar,
                {encoding: logFileEncoding},
                );

        }

    }

    *_VersionTreeStringChangesSince (tree, version) {

        const iterator = tree.upperBound(version);

        if (iterator.data() === null) {
            return 0; // i.e. undefined, speeds up the common case
        }

        const newStringChanges = [];
        let changeCount = 0;

        const versionKeysAsStrings = this._versionKeysAsStrings;
        const state = this.state;

        let version = iterator.data();
        let keyAsString;

        do {

            keyAsString = versionKeysAsStrings.get(version);
            newStringChanges[changeCount++] = [
                keyAsString, 
                state.ValAsStringOfKeyAsString(keyAsString),
                ];

        } while ((version = iterator.next()) !== null);

        return newStringChanges;

    }

    _writeIntentAndReturnItsInfo (intent, intentAsString, isFromStorage) {

        let i;
        const info = super._writeIntentAndReturnItsInfo(
            intent, intentAsString, isFromStorage
            );
        const changeEvents = info.changeEvents;
        const changeCount = changeEvents.length;
        let e;
        const stringChanges = [];

        for (i=0; i<changeCount; i++) {

            e = changeEvents[i];
            stringChanges[i] = [e.keyAsString, e.valAsString];

        }

        const stringChangesAsJson = AsJson(stringChanges);

        this._logFileAppendStream.write(stringChangesAsJson);
        this._logFileAppendStream.write(logFileSeparatorChar);        

        info.stringChangesAsJson = stringChangesAsJson;
        return info;

    }

    sync (clientInputAsJson) {

        const id = this._id;
        let newStringChanges = 0; // i.e. undefined
        let intentStringChangesAsJson = 0; // i.e. undefined
        let rejectedInput = 0; // i.e. false

        try {

            let clientInput;
            try {
                clientInput = FromJson(clientInputAsJson);
                //^ clientInput contains [serverId, version, intentsAsStrings]
            }
            catch (error) {
                rejectBadInput(error);
            }
            if (clientInput === null) {
                rejectBadInput(new TypeError(`client input is null`));
            }
            let version;

            if (clientInput[0] === id) {

                version = clientInput[1];

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._deletionVersionTree, 
                    version,
                    );

            }
            else {

                version = firstVersion;

            }

            if (newStringChanges === 0) { // i.e. undefined

                newStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, 
                    version,
                    );

            }
            else {

                let i;
                const moreStringChanges = this._VersionTreeStringChangesSince(
                    this._versionTree, 
                    version,
                    );
                let changeCount = newStringChanges.length;

                for (i=moreStringChanges.length-1; i>=0; i--) {
                //^ reverse iteration is fine since trees don't contain 
                //  overwritten changes

                    newStringChanges[changeCount++] = moreStringChanges[i];

                }

            }

            //^ get the changes that've happened since the client last synced

            if (clientInput[2] !== 0) { // i.e. undefined

                let i;
                const intentsAsStrings = clientInput[2];
                let intentCount;
                try {
                    intentCount = intentsAsStrings.length;
                } catch (error) {
                    rejectBadInput(error);
                }
                let s;
                let n;
                const IntentFromString = this._IntentFromString;
                let changes;
                let changeCount;
                let stringChanges;
                let j;
                let c;
                intentStringChangesAsJson = intentsAsStrings; 
                //^ they share the same array because they can and we want the 
                //  server to be fast

                for (i=0; i<intentCount; i++) {

                    s = intentsAsStrings[i];
                    if (typeof s !== `string`) {
                        rejectBadInput(new TypeError(
                            `a non-string item was found in intentsAsStrings`
                            ));
                    }
                    try {
                        n = IntentFromString(s);
                    } catch (error) {
                        rejectBadInput(error);
                    }
                    intentStringChangesAsJson[i] = (
                        this._writeIntentAndReturnItsInfo(n, s, false)
                        .stringChangesAsJson
                        );

                }

            }

            //^ add the changes resulting from the client's intents

        } catch (error) {

            if (error.rejectedBadInput === true 
            && error.hasOwnProperty(`reason`)) {

                rejectedInput = 1; // i.e. true
                console.log(error);

            }
            else {

                throw error;

            }

        }

        return AsJson(
            [id, this._currentVersion, intentStringChangesAsJson, 
             newStringChanges, rejectedInput]
            );

    }

    _writeChangeEventToState (changeEvent) {

        super._writeChangeEventToState(changeEvent);

        const keyAsString = changeEvent.keyAsString;
        const keyAsStringVersions = keyAsStringVersions;
        const versionKeysAsStrings = this._versionKeysAsStrings;
        const defaultValAsString = defaultValAsString;
        const oldVersion = keyAsStringVersions.get(keyAsString);

        if (oldVersion !== undefined) {

            versionKeysAsStrings.delete(oldVersion);

            if (changeEvent.oldValAsString === defaultValAsString) {

                this._deletionVersionTree.remove(oldVersion);

            }
            else {

                this._versionTree.remove(oldVersion);

            }

        }

        const newVersion = ++this._currentVersion;

        keyAsStringVersions.set(keyAsString, newVersion);

        versionKeysAsStrings.set(newVersion, keyAsString);

        if (changeEvent.valAsString === defaultValAsString) {

            this._deletionVersionTree.insert(newVersion);

        }
        else {

            this._versionTree.insert(newVersion);

        }

    }

};
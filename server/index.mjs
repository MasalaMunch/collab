import assert from "assert";
import fs from "fs";

import BiMap from "bidirectional-map";
import {RBTree as RbTree} from "bintrees";

import defIn from "@masalamunch/def-in";
import ClassFactory from "@masalamunch/class-factory";
import {BaseCollab, BaseCollabMap} from "@masalamunch/collab-base";


const ServerCollabMap = class extends BaseCollabMap {

    ValOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultVal : this.ValFromString(valAsString)
            );

    }

    ValAsStringOfKeyAsString (keyAsString) {

        const valAsString = this._map.get(keyAsString);
        return (
            valAsString === undefined? 
            this.defaultValAsString : valAsString
            );

    }

    _handleChange (change) {

        if (change.valAsString === this.defaultValAsString) {
            this._map.delete(change.keyAsString);
        }
        else {
            this._map.set(change.keyAsString, change.valAsString);
        }

    }

};


const storageSeparatorChar = `\n`;
const storageEncoding = `utf8`;

const ServerCollabStorage = class {

    constructor ({path, defaultValAsString}) {

        this._path = path;
        this._defaultValAsString = defaultValAsString;

        this._fsAppendStream = fs.createWriteStream(
            this._path, {flags: `a`, encoding: storageEncoding}
            );

    }

    AllChanges () {

        const changeStrings = (
            fs.readFileSync(this._path, {encoding: storageEncoding})
            .split(storageSeparatorChar)
            );

        const compressedChangeStrings = [];
        const compressedChanges = [];

        const changedKeysAsStrings = new Set();

        for (let i=changeStrings.length-2; i>=0; i--) { 
        //^ -2 instead of -1 because the last string should be the empty string

            const change = JSON.parse(changeStrings[i]);

            if (!changedKeysAsStrings.has(change.keyAsString)) {

                changedKeysAsStrings.add(change.keyAsString);

                if (change.valAsString !== this._defaultValAsString) {

                    compressedChangeStrings.push(changeStrings[i]);
                    compressedChanges.push(change);

                }

            }

        }

        if (compressedChangeStrings.length > 0) {
            compressedChangeStrings.push(``);
        }
        fs.writeFileSync(
            this._path, 
            compressedChangeStrings.join(storageSeparatorChar), 
            {encoding: storageEncoding},
            );

        return compressedChanges;

    }

    addChangeToWriteQueue (change) {

        this._fsAppendStream.write(JSON.stringify({
            keyAsString: change.keyAsString, 
            valAsString: change.valAsString, 
            _version: change._version,
            }));
        this._fsAppendStream.write(storageSeparatorChar);

    }

};


const ServerCollab = class extends BaseCollab {

    constructor (config) {

        //TODO move collabmap implementations to base and rename to val-centric 
        //     and val-as-string-centric, figure out default-val-implementation
        //     ...should probably switch boolean checks to undefined checks

        if (!config.CollabMap) {
            config.CollabMap = ServerCollabMap;
        }

        if (!config.CollabStorage) {

        }

        defIn(config, {CollabMap: ServerCollabMap});
        super(config);

        this._keyAsStringVersions = new BiMap();

        this._versionTree = new RbTree();
        this._deletedVersionTree = new RbTree();

        this._readStorage();

    }


    sync (clientInput) {



    }

    _handleChange (change) {


        const oldVersion = this._keyAsStringVersions.get(change.keyAsString);

        if (oldVersion !== undefined) {

            if (change.oldValAsString === this._defaultValAsString) {
                this._deletedVersionTree.remove(oldVersion);
            }
            else {
                this._versionTree.remove(oldVersion)
            }

        }

        if (change.valAsString === this._defaultValAsString) {
            this._deletedVersionTree.insert(change._version);
        }
        else {
            this._versionTree.insert(change._version);
        }


        super._handleChange(change);


    }

};


const ServerCollabClassInterface = class {

    constructor (coreConfig) {
        this._coreConfig = coreConfig;
    }

    Server (serverConfig) {
        const config = {};
        Object.assign(config, this._coreConfig);
        Object.assert(config, serverConfig);
        return new ServerCollab(config);
    }

};


export default ClassFactory(ServerCollabClassInterface);
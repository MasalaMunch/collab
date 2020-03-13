//TODO remove this file once you're finished reimplementing its code 

module.exports = class {

    writeChangesAndVersion (changes, version) {

        let i;
        const changeCount = changes.length;
        let c;
        const dataPrefix = this._dataPrefix;

        for (i=0; i<changeCount; i++) {

            c = changes[i];

            localStorage.setItem(
                dataPrefix + c.keyAsString, 
                AsJson([c.oldValAsString, version, c.valAsString]),
                );

        }

        localStorage.setItem(this._versionKey, String(version));

    }

    deleteOldestIntentThisManyTimes (thisManyTimes) {

        let n;
        const minIntentNumber = this._minIntentNumber;
        const lastNumberToDelete = minIntentNumber + thisManyTimes - 1;
        const intentPrefix = this._intentPrefix;

        for (n=minIntentNumber; n<=lastNumberToDelete; n++) {
            localStorage.removeItem(this._intentPrefix + String(n));
        }

        this._minIntentNumber = lastNumberToDelete + 1;
        //TODO what if old or new minIntentNumbers are undefined?

    }

};
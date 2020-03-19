"use strict";

const defaultVal = require(`./defaultVal.js`);
const defaultValAsString = require(`./defaultValAsString.js`);
const JsoAsString = require(`./JsoAsString.js`);

module.exports = (changesArray) => {

    let i;
    let changes;
    let j;
    let c;
    let key;
    let keyAsString;
    const overwrittenKeysAsStrings = new Set();
    let val;
    let valAsString;
    const allChanges = [];
    const allPartialChangeEvents = [];
    let totalChangeCount = 0;

    for (i=changesArray.length-1; i>=0; i--) {

        changes = changesArray[i];

        for (j=changes.length-1; j>=0; j--) {

            c = changes[j]; // contains [key, val]

            key = c[0];
            keyAsString = JsoAsString(key);

            if (!overwrittenKeysAsStrings.has(keyAsString)) {

                overwrittenKeysAsStrings.add(keyAsString);

                val = c[1];
                valAsString = JsoAsString(val);

                if (valAsString !== defaultValAsString) {

                    allChanges[totalChangeCount] = c;

                    allPartialChangeEvents[totalChangeCount] = (
                        {key, keyAsString, val, valAsString}
                        );

                    totalChangeCount++;

                }

            }

        }

    }
    //^ filter out changes that:
    //
    //      are overwritten by a later change
    //      are deletions (valAsString === defaultValAsString)
    //
    //  (the remaining changes can be returned in the opposite order they 
    //   happened because they contain no overwritten changes)

    return {changes: allChanges, partialChangeEvents: allPartialChangeEvents};

};
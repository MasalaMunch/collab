"use strict";

module.exports = (target, ...sources) => {
//^ same api as https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign

    sources.filter(Boolean).map(Object.entries).flat(1).forEach((entry) => {

        const [key, val] = entry;

        if (target[key] === undefined) {

            target[key] = val;

        }

    });

};
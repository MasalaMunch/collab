"use strict";

const AssertionError = require(`./AssertionError.js`);

module.exports = (somethingTruthy) => {

    if (!somethingTruthy) {

        throw new AssertionError();
        
    }

    };
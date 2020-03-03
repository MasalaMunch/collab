"use strict";

module.exports = (somethingTruthy) => {
    if (!somethingTruthy) {
        throw `AssertionError`;
    }
};
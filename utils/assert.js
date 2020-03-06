"use strict";

module.exports = (somethingTruthy) => {
    if (!somethingTruthy) {
        throw new Error(`an assertion failed`);
    }
};
"use strict";

module.exports = (reason) => {

    throw {rejectedBadInput: true, reason};

};
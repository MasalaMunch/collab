"use strict";

module.exports = (...objects) => {
   
    return Object.fromEntries(objects.map(Object.entries).flat());

};
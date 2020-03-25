"use strict";

module.exports = (...objects) => {
   
    return Object.fromEntries(objects.filter(Boolean).map(Object.entries).flat());

};
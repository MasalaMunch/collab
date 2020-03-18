"use strict";

const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()`;
//SRC^ https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#Description

const idLength = 11;

module.exports = () => {

    const idAsArray = new Array(idLength);

    for (let i=0; i<idLength; i++) {

        idAsArray[i] = chars[Math.floor(Math.random()*chars.length)];

    }

    return idAsArray.join(``);

};
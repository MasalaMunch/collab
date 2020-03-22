"use strict";

module.exports = (error) => {

    return (error.rejectedBadInput === true && error.hasOwnProperty(`reason`));
    
};
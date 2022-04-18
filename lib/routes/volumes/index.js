'use strict';

module.exports = function (router,options) {

	require("./authorizes")(router,options);

	require("./singulars")(router,options);

	require("./batch")(router,options);

};
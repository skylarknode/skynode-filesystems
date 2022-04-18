'use strict';

module.exports = function (router,ufs,options) {

	require("./authorizes")(router,ufs,options.authorizes);

	require("./singulars")(router,ufs);

	require("./batch")(router,ufs);

};
const Unifile = require('../../../lib/index');



module.exports.createVFS = function(rootRealPath,options) {

  const lsconnector = new Unifile.connects.LocalConnector({
    mappedRealFolder : rootRealPath
  });


  const wfs = new Unifile.FileSystem(lsconnector,{});


  return wfs;

};


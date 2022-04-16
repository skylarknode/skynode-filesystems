'use strict';

module.exports = function (router,ufs) {
  // Expose connector methods
  router.post('/:connector/authorize', function(req, res) {
    if(req.body != null) {
      if(req.session.ufs.http)
        req.session.ufs.http.userAddress = req.body.userAddress;
      else
        req.session.ufs.http = req.body;
    }
    ufs.getAuthorizeURL(req.session.ufs, req.params.connector)
    .catch((err) => {
      console.error('Error while authorizing Unifile', err);
      res.statusCode = 400;
      res.end();
    })
    .then((result) => res.end(result));
  });

};
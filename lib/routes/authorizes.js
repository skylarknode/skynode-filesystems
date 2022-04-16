'use strict';

module.exports = function (router,ufs,options) {
  // Expose connector methods
  options = options || {};

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

  // register callback url
  router.get('/:connector/oauth-callback', function(req, res) {
    if('error' in req.query) {
      res.status(500).send(req.query);
    } else {
      ufs.login(req.session.ufs, req.params.connector, req.query)
      .then(function(result) {
        res.cookie('ufs_' + req.params.connector, result);
        res.end('<script>window.close();</script>');
      })
      .catch(function(err) {
        console.error('ERROR', err);
        res.status(500).send(err);
      });
    }
  });


  router.get('/http/callback', function(req, res) {
    // Return a script that get the hash and redirect to oauth-callback
    res.end('<script>' +
          'var token = location.hash.substr(1).split("=")[1];location="/http/oauth-callback?token="+token' +
          '</script>');
  });

  if (options.signin) {
    //app.get('/:connector/signin', function(req, res) {
    //  res.sendFile(Path.join(__dirname, 'public', req.params.connector + '_login.html'));
    //});
    app.get('/:connector/signin', options.signin);

  }

};
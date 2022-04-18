'use strict';

module.exports = function (router,options) {
  // Expose connector methods
  // List files and folders

  options = options || {};
  router.get(/\/ls\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);

    ufs.readdir( "/"+ req.params[0])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.put(/\/mkdir\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.mkdir( "/"+ req.params[0])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.put(/\/put\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.writeFile( "/"+ req.params[0], req.body.content)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.get(/\/get\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.readFile( "/"+ req.params[0])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.patch(/\/mv\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.move( "/"+ req.params[0], req.body.destination)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.delete(/\/rm\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.unlink( "/"+ req.params[0])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.delete(/\/rmdir\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.rmdir( "/"+ req.params[0])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.post(/\/cp\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);

    /*
    let stream = ufs.createReadStream( req.params[0], req.params[1]);
    // Use PassThrough to prevent request from copying headers between requests
    if(req.params[0] !== 'webdav' && req.params[0] !== 'fs') stream = stream.pipe(new PassThrough());
    stream.pipe(ufs.createWriteStream( req.params[0], req.body.destination))
    .pipe(res);
    */
    ufs.copy( req.params[0], req.body.destination)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.get(/\/stat\/(.*)/, function(req, res) {
    const ufs = options.ufs(req,res);
    ufs.stat( req.params[0])
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      res.status(400).send(err.message);
    });
  });


};
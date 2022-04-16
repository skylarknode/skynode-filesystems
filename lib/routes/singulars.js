'use strict';

module.exports = function (router,ufs) {
  // Expose connector methods
  // List files and folders
  router.get(/\/(.*)\/ls\/(.*)/, function(req, res) {
    ufs.readdir(req.session.ufs, req.params[0], req.params[1])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.put(/\/(.*)\/mkdir\/(.*)/, function(req, res) {
    ufs.mkdir(req.session.ufs, req.params[0], req.params[1])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.put(/\/(.*)\/put\/(.*)/, function(req, res) {
    ufs.writeFile(req.session.ufs, req.params[0], req.params[1], req.body.content)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.get(/\/(.*)\/get\/(.*)/, function(req, res) {
    ufs.readFile(req.session.ufs, req.params[0], req.params[1])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.patch(/\/(.*)\/mv\/(.*)/, function(req, res) {
    ufs.move(req.session.ufs, req.params[0], req.params[1], req.body.destination)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.delete(/\/(.*)\/rm\/(.*)/, function(req, res) {
    ufs.unlink(req.session.ufs, req.params[0], req.params[1])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.delete(/\/(.*)\/rmdir\/(.*)/, function(req, res) {
    ufs.rmdir(req.session.ufs, req.params[0], req.params[1])
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.post(/\/(.*)\/cp\/(.*)/, function(req, res) {

    /*
    let stream = ufs.createReadStream(req.session.ufs, req.params[0], req.params[1]);
    // Use PassThrough to prevent request from copying headers between requests
    if(req.params[0] !== 'webdav' && req.params[0] !== 'fs') stream = stream.pipe(new PassThrough());
    stream.pipe(ufs.createWriteStream(req.session.ufs, req.params[0], req.body.destination))
    .pipe(res);
    */
    ufs.copy(req.session.ufs, req.params[0], req.params[1],req.body.destination)
    .then(function(result) {
      res.send(result);
    })
    .catch(function(err) {
      console.error(err);
      res.status(400).send(err);
    });
  });

  router.get(/\/(.*)\/stat\/(.*)/, function(req, res) {
    ufs.stat(req.session.ufs, req.params[0], req.params[1])
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      res.status(400).send(err.message);
    });
  });


};
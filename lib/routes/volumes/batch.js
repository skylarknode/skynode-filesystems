'use strict';

module.exports = function (router,ufs) {
  router.post(/\/batch\/(.*)/, function(req, res) {
    const path = "/"+ req.params[1];
    const batch = [
      {name: 'mkdir', path: path},
      {name: 'writeFile', path: path + '/test.txt', content: 'Hello world'},
      {name: 'writeFile', path: path + '/test2.txt', content: 'Hello world too'},
      {name: 'rename', path: path + '/test.txt', destination: path + '/test_old.txt'},
      {name: 'unlink', path: path + '/test2.txt'},
      {name: 'rmdir', path: path}
    ];
    ufs.batch(req.params[0], batch)
    .then((result) => {
      res.send(result);
    })
    .catch((err) => {
      console.error(err);
      res.status(400).send(err);
    });
  });
};
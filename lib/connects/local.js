const lz = require('lzutf8');//Remove after decoupling

const _fs = require('fs-extra');
const m_path = require('path');

const Mime = require('mime');

const prettyBytes = require('pretty-bytes')
const util = require('util')
const moment = require('moment')
const Promise = require('bluebird');
const debug = require('debug')('skynode-fs:webfs');
const fsp = Promise.promisifyAll(require('fs'));


const  archiver = require('archiver');
const _ = require('underscore');
const nfs = require('skynode-nfs')

const Tools = require('./tools');


///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////


/*
 * Creates file information in a format understands
 */
function createFileInfo(path, real, iter, stat) {
  var info = nfs.statSync(real);
  info.dirname = info.path = path;
  return info;
}

/*
 * Check if given file exists or not
 */
function existsWrapper(checkFound, real, resolve, reject) {
  _fs.exists(real, (exists) => {
    if ( checkFound ) {
      if ( exists ) {
        reject('File or directory already exist.');
      } else {
        resolve(true);
      }
    } else {
      if ( exists ) {
        resolve(true);
      } else {
        reject('No such file or directory');
      }
    }
  });
}

/*
 * Reads a directory and returns in a format  understands
 */
function readDir(path,real, filter) {
  filter = filter || function(iter) {
    return ['.', '..'].indexOf(iter) === -1;
  };

  return new Promise((resolve, reject) => {
    _fs.readdir(real, (err, list) => {
      if ( err ) {
        reject(err);
      } else {
        resolve(list.filter(filter).map((iter) => {
          return nfs.statSync(nfs.join(path, iter),nfs.join(real, iter), iter);
        }));
      }
    });
  });
}

function statToFileInfos(filename, stat) {
  const isDir = stat.isDirectory();
  return {
    size: stat.size,
    modified: stat.mtime,
    name: filename,
    isDir: isDir,
    mime: isDir ? 'application/directory' : Mime.lookup(filename)
  };
}

const LocalConnector = function() {
    this.initialize.apply(this, arguments);
};

_.extend(LocalConnector.prototype,{

    //options : {
    //   volume : 
    //}

  decode : function(path) {
    if (this._options.decode) {
      return this._options.decode(path)
    }

    var id = path
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\./g, '=');

    return lz.decompress(id + '==', {
      inputEncoding: "Base64"
    });
  },

  encode : function(id) {
    if (this._options.encode) {
      return this._options.encode(id)
    }

    var path = lz.compress(id, {
        outputEncoding: "Base64"
    });
    return path.replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '.');
  },


  initialize: function(options) {
        options = _.extend({}, options);
        this._options = options;   

    this.config = options;
    this.infos = Tools.mergeInfos(options.infos, {
      name: "local",
      displayName: 'LocalStorage',
      icon: '../assets/rs.png',
      description: 'Edit files on a LocalStorage service'
    });
    this.name = this.infos.name;


        this._mappedRealFolder = options.mappedRealFolder; 
  },

  getInfos : function(session) {
    return Object.assign({
      isLoggedIn: true,
      isOAuth: false,
      username: process.env.USER
    }, this.infos);
  },

  // Auth methods are useless here

  getAuthorizeURL(session) {
    return Promise.resolve('');
  },

  setAccessToken(session, token) {
    return Promise.resolve(token);
  },

  clearAccessToken(session) {
    return Promise.resolve();
  },

  login(session, loginInfos) {
    return new Promise.resolve();
  },

  //Filesystem commands

  archive : function (session,paths,to,options) {
    var self = this;

    var sources = paths.map(function(path){
      return self.toRealPath(path);
    });

    return nfs.archive(sources,to,options);

  },

  copy: function(session,srcPath,destPath) {
    const realSrcPath = this.toRealPath(srcPath);
    const realDestPath = this.toRealPath(destPath);

    return new Promise(function (resolve, reject) {
      existsWrapper(false, realSrcPath, () => {
        existsWrapper(true, realDestPath, () => {
          _fs.access(nfs.dirname(realDestPath), nfs.W_OK, (err) => {
            if ( err ) {
              reject('Cannot write to destination');
            } else {
              _fs.copy(realSrcPath, realDestPath, (error, data) => {
                if ( error ) {
                  reject('Error copying: ' + error);
                } else {
                  resolve(true);
                }
              });
            }
          });
        }, reject);
      }, reject);
    });
  },

  exists: function(session,path) {
    const realPath = this.toRealPath(path);
    return new Promise(function (resolve, reject) {
      nfs.exists(realPath, (exists) => {
        resolve(exists);
      });
    });
  },

  find: function(session,path,options) { //TODO
    options = options || {};
    const query = (options.query || '').toLowerCase();
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      if ( !options.recursive ) {
        readDir(path, realPath, (iter) => {
          if (  ['.', '..'].indexOf(iter) === -1 ) {
            return iter.toLowerCase().indexOf(query) !== -1;
          }
          return false;
        }).then(resolve).catch(reject);

        return;
      }

      let find;
      try {
        find = require('findit')(realPath);
      } catch ( e ) {
        reject('Failed to load findit node library: ' + e.toString());
        return;
      }

      let list = [];

      function addIter(file, stat) {
        const filename = nfs.basename(file).toLowerCase();
        const fpath = path + file.substr(realPath.length).replace(/^\//, '');
        list.push(createFileInfo(fpath, file, null, stat));
      }

      find.on('path', () => {
        if ( options.limit && list.length >= options.limit ) {
          find.stop();
        }
      });

      find.on('directory', addIter);
      find.on('file', addIter);

      find.on('end', () => {
        resolve(list);
      });

      find.on('stop', () => {
        resolve(list);
      });
    });
  },

  info: function(session,resourceId) { //TODO
    const realPath = this.toRealPath(resourceId);

    return nfs.stat(realPath).then(function(stat){
      var r = {
        name: nfs.basename(p),
        size: stat.size,
        hash: private.encode(p),
        mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
        ts: Math.floor(stat.mtime.getTime() / 1000),
        volumeid: 'v' + info.volume + '_'
      }

      if (r.mime === false) {
        r.mime = 'application/binary';
      }

      if (r.mime.indexOf('image/') == 0) {
        var filename = private.encode(p);
        var tmbPath = nfs.join(config.tmbroot, filename + ".png");
        if (nfs.existsSync(tmbPath)) {
          r.tmb = filename + '.png';
        } else {
          r.tmb = "1";
        }
      }

      if (!info.isRoot) {
        var parent = nfs.dirname(p);
        // if (parent == root) parent = parent + path.sep;
        r.phash = private.encode(parent);
      } else {
          r.options = {
            disabled: config.disabled,
            archivers: {
              create: ['application/zip'],
              createext: {
                'application/zip': 'zip'
              }
            },
            url: config.roots[info.volume].URL
          }
          if (config.volumeicons[info.volume]) {
            r.options.csscls = config.volumeicons[info.volume];
          }
      }
      var acl = config.acl(p);
      r.read = acl.read;
      r.write = acl.write;
      r.locked = acl.locked;
      //check if this folder has child.
      r.isdir = (r.mime == 'directory');

      if (r.isdir) {
        var items = nfs.readdirSync(p);
        for (var i = 0; i < items.length; i++) {
          if (nfs.lstatSync(nfs.join(p, items[i])).isDirectory()) {
              r.dirs = 1;
              break;
            }
        }
      }
      return r;
    });
  },


  move: function(session,srcPath, destPath) { //TODO
    const realSrcPath = this.toRealPath(srcPath);
    const realDestPath = this.toRealPath(destPath);

    return new Promise(function (resolve, reject) {
       _fs.access(realSrcPath, nfs.R_OK, (err) => {
        if ( err ) {
          reject('Cannot read source');
        } else {
          _fs.access(nfs.dirname(realDestPath), nfs.W_OK, (err) => {
            if ( err ) {
              reject('Cannot write to destination');
            } else {
              _fs.rename(realSrcPath, realDestPath, (error, data) => {
                if ( error ) {
                  reject('Error renaming/moving: ' + error);
                } else {
                  resolve(true);
                }
              });
            }
          });
        }
      });
    });
  },

  mkdir: function(session,path) {
    console.log("path1:" + path + "\n");
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      existsWrapper(true, realPath, () => {
        nfs.mkdir(realPath, (err) => {
          if ( err ) {
            reject('Error creating directory: ' + err);
          } else {
            resolve(true);
          }
        });
      }, reject);
    });
  },

  quoat: function(session) {
    const rootReal = this.toRealPath("/");

    return nfs.quoat(rootReal);
  },

  read: function(session,path,options) { //TODO
    /*eslint new-cap: "off"*/
    const realPath = this.toRealPath(path);
    options = options || {};

    return nfs.stat(realPath).then(function(info){
      info.path = path;
      info.options = options;
      if ( options.stream !== false ) {
          info.streaming = (options) => nfs.createReadStream(realPath, options);
          return info;
      } else {
        return pfs.readFileAsync(realPath).then(function(data) {
          info.data = data;
          return info;

        });
      }
    });
  },

  readdir : function(session,dirId,filter) { 
    filter = filter || function(iter) {
      return ['.', '..'].indexOf(iter) === -1;
    };

    const realPath = this.toRealPath(dirId);

    return new Promise((resolve, reject) => {
      nfs.readdir(realPath, (err, entries) => {
        if ( err ) {
          reject(err);
        } else {
          resolve(entries.filter(filter).map((entry) => {
              return statToFileInfos(entry,nfs.statSync(nfs.join(realPath,entry)));
          }));
        }
      });

    });
  },

  rename : function(session, srcId, destId) {
    const realSrcPath = this.toRealPath(srcId);
    const realDestPath = this.toRealPath(destId);
    try {
      return nfs.rename(realSrcPath,realDestPath);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  toRealPath : function(idOrPath) {
    if (!idOrPath) {
      return this._mappedRealFolder;
    }
    var path ;
    if (idOrPath.startsWith("/")) {
      path = idOrPath;
    } else {
      path = this.decode(idOrPath);
    }
    return nfs.join(this._mappedRealFolder,path);
  },

  tree: function(session,path,options) { //TODO
    options = options || {};
    const realPath = this.toRealPath(path);
    const self = this;

    options.page = parseInt(options.page) || 1;
    options.limit = parseInt(options.limit) || 100;
    options.maxDepth = parseInt(options.maxDepth) || 10;
    options.concurrency = parseInt(options.concurrency) || 100;
    options.cacheTTL = options.cacheTTL || 86400; //24 hours

    options.filters = [nfs.noDotFiles];

    if(options.skip) {
      options.filters.push(options.skip);
    }

    debug('List for path %s and options %o', path, options);

    var pages = 0;
    var concurrency = {concurrency: options.concurrency};
    var num = 0;
    var totalSize = 0;
    var directorySize = nfs.getDirectorySize(options);

    return nfs.paths(realPath, options).map(function(f) {
       var cpath = nfs.join(path, f),
           cRealPath = self.toRealPath(cpath);

       debug('Map stat', f);

       return nfs.stat(cRealPath).then(function(info){
          info.dirname = path;
          info.path = cpath;
          return info;

       }).catch(nfs.gracefulCatch(nfs.DEFAULT_STAT, path));
    }, concurrency).filter(options.searchFilter ? options.searchFilter : function(e) { return e })
    .map(options.sort === 'size' ? directorySize : function(e) { return e })
    .call('sort', options.sortMethod || function() { return; })
    .filter(function(value, index, length) {

      if(!num)
        num = length

      if(!pages)
        pages = Math.ceil(length / options.limit)

      if(options.page == 1) {
        return index < (options.limit * options.page);
      }

      return index >= (options.page - 1) * options.limit && index < options.page * options.limit
    }, concurrency)
    .map(options.sort !== 'size' ? directorySize : function(e) { return e })
    .map(function(f) {
      totalSize += f.size
      f.humanSize = prettyBytes(f.size)

      return f
    }, concurrency).then(function(tree) {
      var breadcrumb = nfs.buildBreadcrumb(options.root, options.path)

      return util._extend({
        tree: tree, 
        pages: pages,
        size: prettyBytes(totalSize),
        num: num,
        breadcrumb: breadcrumb
      }, options)
    })
  },

  stat : function(session, resourceId) { 
    const realPath = this.toRealPath(resourceId);
    try {
      return nfs.stat(realPath)
      .then((stat) => {
        return statToFileInfos(nfs.basename(realPath), stat);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  },

  writeFile: function(session,path, data,options) { 
    const realPath = this.toRealPath(path);
    options = options || {};

    return new Promise(function (resolve, reject) {
      var encoding;
      if ( options.raw === false ) {
        data = unescape(data.substring(data.indexOf(',') + 1));
        data = new Buffer(data, 'base64');
        encoding = "utf8";
      } else {
        encoding = options.rawtype || 'binary';
      }

      nfs.writeFile(realPath, data, encoding, (error) => {
        if ( error ) {
          reject('Error writing file: ' + error);
        } else {
          resolve(true);
        }
      });
    });
  },

  unlink: function(session,path) {
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      if ( ['', '.', '/'].indexOf() !== -1 ) {
        reject('Permission denied');
        return;
      }

      existsWrapper(false, realPath, () => {
        nfs.remove(realPath, (err) => {
          if ( err ) {
            reject('Error deleting: ' + err);
          } else {
            resolve(true);
          }
        });
      }, reject);
    });
  }
});

///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = LocalConnector;

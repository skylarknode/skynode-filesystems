const lz = require('lzutf8');//Remove after decoupling

const _fs = require('fs-extra');
const m_path = require('path');


const prettyBytes = require('pretty-bytes')
const util = require('util')
const moment = require('moment')
const Promise = require('bluebird');
const debug = require('debug')('skynode-fs:webfs');
const fsp = Promise.promisifyAll(require('fs'));


const  archiver = require('archiver');
const _ = require('underscore');
const nfs = require('skynode-nfs')
var mime = require('mime');


const DATE_FORMAT = 'llll'

const DEFAULT_STAT = {
  directory: false, 
  type: 'unknown',
  size: 0,
  mtime: 0,
  lastModified: '',
  atime: 0,
  lastAccessed: '',
  ctime: 0,
  lastChanged: '',
  depth: 0
}


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
          return nfs.statSync(m_path.join(path, iter),m_path.join(real, iter), iter);
        }));
      }
    });
  });
}



const VFS = function() {
    this.initialize.apply(this, arguments);
};

_.extend(VFS.prototype,{

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


  initialize: function(mappedRealFolder,options) {
        options = _.extend({}, options);
        this._options = options;   
        this._mappedRealFolder = mappedRealFolder; 
  },

  archive : function (paths,to,options) {
    var self = this;

    var sources = paths.map(function(path){
      return self.toRealPath(path);
    });

    return nfs.archive(sources,to,options);

  },

  copy: function(srcPath,destPath) {
    const realSrcPath = this.toRealPath(srcPath);
    const realDestPath = this.toRealPath(destPath);

    return new Promise(function (resolve, reject) {
      existsWrapper(false, realSrcPath, () => {
        existsWrapper(true, realDestPath, () => {
          _fs.access(m_path.dirname(realDestPath), nfs.W_OK, (err) => {
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

  exists: function(path) {
    const realPath = this.toRealPath(path);
    return new Promise(function (resolve, reject) {
      _fs.exists(realPath, (exists) => {
        resolve(exists);
      });
    });
  },

  find: function(path,options) {
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
        const filename = m_path.basename(file).toLowerCase();
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

  info2: function(resourceId) {
    const realPath = this.toRealPath(resourceId);
    var self = this;

    return nfs.stat(realPath).then(function(stat){
      var r = {
        name: m_path.basename(realPath),
        size: stat.size,
        hash: self.encode(p),
        mime: stat.isDirectory() ? 'directory' : mime.lookup(p),
        ts: Math.floor(stat.mtime.getTime() / 1000),
        volumeid: 'v' + info.volume + '_'
      }

      if (r.mime === false) {
        r.mime = 'application/binary';
      }

      if (r.mime.indexOf('image/') == 0) {
        var filename = self.encode(p);
        var tmbPath = path.join(config.tmbroot, filename + ".png");
        if (nfs.existsSync(tmbPath)) {
          r.tmb = filename + '.png';
        } else {
          r.tmb = "1";
        }
      }

      if (!info.isRoot) {
        var parent = path.dirname(p);
        // if (parent == root) parent = parent + path.sep;
        r.phash = self.encode(parent);
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
          if (nfs.lstatSync(path.join(p, items[i])).isDirectory()) {
              r.dirs = 1;
              break;
            }
        }
      }
      return r;
    });
  },

  info: function(path) {
    const realPath = this.toRealPath(path);

    return nfs.stat(realPath).then(function(stat) {
      var info = {
        name: m_path.basename(path),
        mimeType: mime.lookup(path),
        ext: m_path.extname(path),
        dirname: m_path.dirname(path),
        path: path,
        size : stat.size,
        mtime :  stat.mtime.getTime(),
        lastModified : moment(stat.mtime).format(DATE_FORMAT),
        atime : stat.atime.getTime(),
        lastAccessed : moment(stat.atime).format(DATE_FORMAT),
        ctime : stat.ctime.getTime(),
        lastChanged : moment(stat.ctime).format(DATE_FORMAT),
      };

      if(stat.isDirectory()) {
        info.directory = true;
        info.depth = 0;
        info.type = 'directory';
      } else {
        info.type = "file"
      }

      return info;
    });
  },

  list: function(path,options) {
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
       var cpath = m_path.join(path, f),
           cRealPath = self.toRealPath(cpath);

       debug('cpath ', cpath);
       debug('cRealPath ', cRealPath);
       debug('Map stat', f);

       return self.info(cpath).then(function(info){
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

  move: function(srcPath, destPath) {
    const realSrcPath = this.toRealPath(srcPath);
    const realDestPath = this.toRealPath(destPath);

    return new Promise(function (resolve, reject) {
       _fs.access(realSrcPath, nfs.R_OK, (err) => {
        if ( err ) {
          reject('Cannot read source');
        } else {
          _fs.access(m_path.dirname(realDestPath), nfs.W_OK, (err) => {
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

  mkdir: function(path) {
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      existsWrapper(true, realPath, () => {
        _fs.mkdirs(realPath, (err) => {
          if ( err ) {
            reject('Error creating directory: ' + err);
          } else {
            resolve(true);
          }
        });
      }, reject);
    });
  },

  quoat: function() {
    const rootReal = this.toRealPath("/");

    return nfs.quoat(rootReal);
  },

  read: function(path,options) {
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


  toRealPath : function(idOrPath) {
    if (!idOrPath) {
      return this._mappedRealFolder;
    }
    var path ;
    if (!this._options.decodePath ||  idOrPath.startsWith(m_path.sep)) {
      path = idOrPath;
    } else {
      path = this.decode(idOrPath);
    }
    return m_path.join(this._mappedRealFolder,path);
  },

  write: function(path, data,options) {
    const realPath = this.toRealPath(args.path);
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

      _fs.writeFile(realPath, data, encoding, (error) => {
        if ( error ) {
          reject('Error writing file: ' + error);
        } else {
          resolve(true);
        }
      });
    });
  },

  unlink: function(path) {
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      if ( ['', '.', '/'].indexOf() !== -1 ) {
        reject('Permission denied');
        return;
      }

      existsWrapper(false, realPath, () => {
        _fs.remove(realPath, (err) => {
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

module.exports.VFS = VFS;
module.exports.createVFS = function(rootRealPath,options) {
  return new VFS(rootRealPath,options);
};


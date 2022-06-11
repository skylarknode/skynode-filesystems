const lz = require('lzutf8');//Remove after decoupling

const m_path = require('path');

const Mime = require('mime');

const util = require('util')
const Promise = require('bluebird');
const debug = require('debug')('skynode-fs:webfs');


const  archiver = require('archiver');
const _ = require('underscore');
const nfs = require('skynode-nfs')

const Tools = require('./tools');
const slangx = require('skylark-langx');

const Jimp = require('jimp');

///////////////////////////////////////////////////////////////////////////////
// HELPERS
///////////////////////////////////////////////////////////////////////////////



/*
 * Check if given file exists or not
 */
function existsWrapper(checkFound, real, resolve, reject) {
  nfs.exists(real, (err,exists) => {
    if (err) {
      reject(err);
      return;
    }
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



function statToFileInfos(path, stat,id) {
  const isDir = stat.isDirectory();
  var info = {
///        isDir: isDir,

        id : id, // he ID of the file(directory).
        //hash: private.encode(p), // elfinder

        name: nfs.basename(path),   //The name of the file(directory).

        mimeType: isDir ? 'application/directory' : Mime.getType(path),   //The MIME type of the file.
        //mime : isDir ? 'application/directory' , // unifile
        //mime: stat.isDirectory() ? 'directory' : mime.lookup(p), // elfinder

        dirname: nfs.dirname(path),
        path: path,

        size : stat.size,              // The size of the file's content in bytes. 

        createdTime : stat.birthtime,

        changedTime : stat.ctime,      //
        //ctime : stat.ctime.getTime(), // explorer
        //lastChanged : moment(stat.ctime).format(DATE_FORMAT),// explorer
        modifiedTime : stat.mtime,
        //modified: stat.mtime, // unifile
        //mtime :  stat.mtime.getTime(),// explorer
        //lastModified : moment(stat.mtime).format(DATE_FORMAT),// explorer
        //ts: Math.floor(stat.mtime.getTime() / 1000), //elfinder

        accessedTime : stat.atime,
        //atime : stat.atime.getTime(),  // explorer
        //lastAccessed : moment(stat.atime).format(DATE_FORMAT),  // explorer

  };

  if (!info.mimeType ) {
    info.mimeType = 'application/binary';
  }

  ///console.log("statToFileInfos:\n");
  ///console.dir(info);

  if (info.mimeType.indexOf('image/') == 0) {
    //var filename = private.encode(p);
    //var tmbPath = nfs.join(config.tmbroot, filename + ".png");
    //if (nfs.existsSync(tmbPath)) {
    //  r.tmb = filename + '.png';
    //} else {
    //  r.tmb = "1";
    //}
  }

  return info;
}


/*
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
*/

class LocalConnector {

    //options : {
    //   volume : 
    //}

  constructor(options) {
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
  }

  decode (path) {
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
  }

  encode(id) {
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
  }

  getInfos() {
    return Object.assign({
      isLoggedIn: true,
      isOAuth: false,
      username: process.env.USER
    }, this.infos);
  }

  // Auth methods are useless here

  getAuthorizeURL() {
    return Promise.resolve('');
  }

  setCredentials(token) {
    return Promise.resolve(token);
  }

  clearAccessToken() {
    return Promise.resolve();
  }

  login( loginInfos) {
    return new Promise.resolve();
  }

  //Filesystem commands

  archive  (paths,to,options) {
    var self = this;

    var sources = paths.map(function(path){
      return self.toRealPath(path);
    });

    return nfs.archiveAsync(sources,to,options);

  }

  _copy(srcPath,destPath) { // TODO
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
  }

  copy( srcId, destId) {
    const realSrcPath = this.toRealPath(srcId);
    const realDestPath = this.toRealPath(destId);
    try {
      return nfs.copyAsync(realSrcPath,realDestPath);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  exists(path) {
    const realPath = this.toRealPath(path);
    return new Promise(function (resolve, reject) {
      nfs.exists(realPath, (exists) => {
        resolve(exists);
      });
    });
  }

  find(path,options) { //TODO
    options = options || {};
    const query = (options.query || '').toLowerCase();
    const realPath = this.toRealPath(path);

    /*
     * Reads a directory and returns in a format  understands
     */
    function readDir(path,real, filter) {
      filter = filter || function(iter) {
        return ['.', '..'].indexOf(iter) === -1;
      };

      return new Promise((resolve, reject) => {
        nfs.readdir(real, (err, list) => {
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

    /*
     * Creates file information in a format understands
    */
    function createFileInfo(path, real, iter, stat) {
      var info = nfs.statSync(real);
      info.dirname = info.path = path;
      return info;
    }


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
  }


  mkdir( path) { //mkdir
    const realPath = this.toRealPath(path);
    try {
      return nfs.mkdirAsync(realPath);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  quoat() {
    const rootReal = this.toRealPath("/");

    return nfs.quoat(rootReal);
  }

  read(path,options) { //TODO
    /*eslint new-cap: "off"*/
    const realPath = this.toRealPath(path);
    options = options || {};

    return nfs.statAsync(realPath).then(function(info){
      info.path = path;
      info.options = options;
      if ( options.stream !== false ) {
          info.streaming = (options) => nfs.createReadStream(realPath, options);
          return info;
      } else {
        return nfs.readFileAsync(realPath).then(function(data) {
          info.data = data;
          return info;

        });
      }
    });
  }

  readdir(dirId,filter) { 
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
              return statToFileInfos(dirId + (dirId.endsWith("/")? "": "/") + entry,nfs.statSync(nfs.join(realPath,entry)));
          }));
        }
      });

    });
  }

  readFile( fildId) {
    const realPath = this.toRealPath(fildId);
    try {
      return nfs.readFileAsync(realPath);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  remove(path) {
    const realPath = this.toRealPath(path);

    return new Promise(function (resolve, reject) {
      if ( ['', '.', '/'].indexOf() !== -1 ) {
        reject('Permission denied');
        return;
      }
      ///console.log("remove:realPth:" + realPath);
      existsWrapper(false, realPath, () => {
      ///console.log("remove:realPth2:" + realPath);
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

  rename (path,newName) {
    var dirname = slangx.paths.dirname(path),
        destPath = slangx.paths.join(dirname, newName);

    ///console.log("\npath:" + path);

    ///console.log("\ndestPath:" + destPath);
    const realSrcPath = this.toRealPath(path);
    const realDestPath = this.toRealPath(destPath);
    return nfs.moveAsync(realSrcPath,realDestPath).then(()=>{
      return this.stat(destPath);
    });
  }

  move( srcId, destId) {
    const realSrcPath = this.toRealPath(srcId);
    const realDestPath = this.toRealPath(destId);
    return nfs.moveAsync(realSrcPath,realDestPath).then(()=>{
      return this.stat(destId);
    });
  }

  toPath(id) {
    var path ;
    if (!this._options.decodePath ||  id.startsWith("/")) {
      path = id;
    } else {
      path = this.decode(id);
    }
    return path;  
  }

  toRealPath(idOrPath,isPath) {
    if (!idOrPath) {
      return this._mappedRealFolder;
    }
    let path = idOrPath;
    if (!isPath) {
      path = this.toPath(idOrPath);
    }

    return nfs.join(this._mappedRealFolder,path);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
  }

  list(path,options) { //TODO
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
    var directorySize = function(f){
        return nfs.capacity('', f, options).then(function(){
          return f;
        })
    };

    return nfs.paths(realPath, options).map(function(f) {
       var cpath = nfs.join(path, f),
           cRealPath = self.toRealPath(cpath);

       debug('Map stat', f);

       return self.stat(cpath);
       /*
       then(function(info){
          info.dirname = path;
          info.path = cpath;
          return info;

       });
       */
       ///catch(nfs.gracefulCatch(nfs.DEFAULT_STAT, path));
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
      totalSize += f.size;
      ///f.humanSize = prettyBytes(f.size)
      return f
    }, concurrency).then(function(tree) {
        return {
          files : tree,
          pages : pages,
          totalCount : num,
          totalSize : totalSize,
          nextPageToken : options.page<pages ? options.page+1 : -1
        };


      /*
      var breadcrumb = nfs.buildBreadcrumb(options.root, options.path)

      return util._extend({
        tree: tree, 
        pages: pages,
        size: prettyBytes(totalSize),
        num: num,
        breadcrumb: breadcrumb
      }, options)
      */
    });
  }

  stat ( id) { 
    const 
      path = this.toPath(id),
      realPath = this.toRealPath(path);

    try {
      return nfs.statAsync(realPath)
      .then((stat) => {
        return statToFileInfos(path, stat,id);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  thumbnail(fileId,options) {
    const 
      path = this.toPath(fileId),
      realPath = this.toRealPath(path);

    ///console.log("path:" + path +",realPath:" + realPath);    
    return Jimp.read(realPath).then(function(img) {
        var op = options.encode(path);
        img.resize(48, 48)
          .write(spath.join(options.tmbroot, op + ".png"));
        return op;
    });

    /*

    var tasks = [];
    slangx.each(fileIds, function(fileId) {
        const 
          path = this.toPath(fileId),
          realPath = this.toRealPath(path);
        tasks.push(Jimp.read(realPath)
            .then(function(img) {
              var op = options.encode(path);
              img.resize(48, 48)
                .write(spath.join(options.tmbroot, op + ".png"));
              return Promise.resolve(op);
        }));
    })
    return Promise.all(tasks)
      .then(function(hashes) {
        var rtn = {};
        slangx.each(hashes, function(hash) {
          rtn[hash] = hash + '.png';
        })
        return ({
          images: rtn
        });
      });
    */
  }

  write(path, data,options) {  //TODO
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
  }

  writeFile( fileId, data) { // 
    const realPath = this.toRealPath(fileId);
    try {
      return nfs.writeFileAsync(realPath, data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  unlink(path) {
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
}

///LocalConnector.name = "local";


///////////////////////////////////////////////////////////////////////////////
// EXPORTS
///////////////////////////////////////////////////////////////////////////////

module.exports = LocalConnector;

'use strict';
var util = require('util');
var async = require('async');
var Promise = require('bluebird');
var m_path = require('path');
const prettyBytes = require('pretty-bytes');
const moment = require('moment')

const utils = require("../../../nfs");
/**
 * Just wanted to test ES6 new stuff
 * ... just kidding extend one arg to another instead of only the first one
 * @param object origin
 * @param object ...add
 * @return origin
 */
var extend = function() {
  var add = [].slice.call(arguments)
  var origin = add.shift()

  for(let i in add) {
    origin = util._extend(origin, add[i]) 
  }

  return origin
}


/**
 * Handles middlewares in parallel
 */
var parallelMiddlewares = function(middlewares) {
  return function(req, res, next) {
    return async.each(middlewares, function(m, cb) {
      return m(req, res, cb) 
    }, next) 
  }
}

/**
 * firstExistingPath
 * Get back the first path that does exist
 * @param array paths 
 * @return string the founded path
 */
var firstExistingPath = function(paths) {
  for(let i in paths) {
    if(paths[i] && utils.existsSync(paths[i])) {
      return paths[i]
    }
  }

  return false
}

/**
 * Build an URL string from params
 * this is used by the view to generate correct paths according to 
 * the sort, order, pages, search etc.
 * @param string path
 * @param string search
 * @param object options - will be built to a query key=value
 */
var buildUrl = function(path, search, options) {

  var str = ''
  var first = true

  for(let i in options) {
    if(options[i]) {
      str += first ? '?' : '&'
      str += i + '=' + options[i]
      first = false
    }
  }

  if(search) {
    return '/search' + str + '&search=' + search + '&path=' + encodeURIComponent(m_path.normalize(path))
  }

  return '/' + str + '&path=' + encodeURIComponent(m_path.normalize(path))
}


/*
 * Reads EXIF data
 */
function readExif(path, mime) {
  mime = mime || '';

  let _read = function defaultRead(resolve, reject) {
    resolve(null);
  };

  if ( mime.match(/^image/) ) {
    try {
      _read = function exifRead(resolve, reject) {
        /*eslint no-new: "off"*/
        new require('exif').ExifImage({image: path}, (err, result) => {
          if ( err ) {
            reject(err);
          } else {
            resolve(JSON.stringify(result, null, 4));
          }
        });
      };
    } catch ( e ) {}
  }

  return new Promise(_read);
}

/**
 * Secures a string for a command line search
 * strips: ", ', \, &, |, ;, -
 * @param string str
 * @return string
 */
var secureString = function secureString(str) {
  return str.replace(/"|'|\\|&|\||;|-/g, '')
}


/**
 * Handles system error, usually a Promise.catch
 * @param function next middleware next
 * @return function called by a Promise.catch
 */
var handleSystemError = function(next) {
   return function(e) {
   
     console.error(e.stack)

     return next(e);
     //return next(new HTTPError('A server error occur, if this happens again please contact the administrator: '+e.message, 500))
   }  
}


var buildBreadcrumb = function(root, path) {
  var breadcrumbs = [{path: root, name: root}]

  if(!path) {
    return breadcrumbs;
  }

  let paths = path.replace(root, '')
    .split('/')
    .filter(function(v) { return v != '' })

  for(let i in paths) {
    breadcrumbs[parseInt(i)+1] = {
      path: utils.join(breadcrumbs[i].path, paths[i]),
      name: paths[i]
    }
  }

  return breadcrumbs
}

const DATE_FORMAT = 'llll'

var prettyTime = function(t) {
    return moment(t).format(DATE_FORMAT);
};

var isDirectory = function (info) {
    return info.isDir || info.mimeType == "application/directory" || info.mimeType == "directory";
};

utils.extend = extend;
utils.parallelMiddlewares = parallelMiddlewares;
utils.firstExistingPath = firstExistingPath;
utils.buildUrl = buildUrl;
utils.secureString = secureString;
utils.handleSystemError = handleSystemError;
utils.buildBreadcrumb = buildBreadcrumb;

utils.prettyBytes = prettyBytes;
utils.prettyTime = prettyTime;
utils.isDirectory = isDirectory;

module.exports = utils;


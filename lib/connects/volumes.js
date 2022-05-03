/** @namespace Unifile */
'use strict';

/**
 * The built-in Node.js WritableStream class
 * @external WritableStream
 * @see https://nodejs.org/api/stream.html#stream_writable_streams
 */

/**
 * The built-in Node.js ReadableStream class
 * @external ReadableStream
 * @see https://nodejs.org/api/stream.html#stream_readable_streams
 */

/**
 * Bluebird Promise class
 * @external Promise
 * @see http://bluebirdjs.com/docs/api-reference.html
 */

/**
 * State of the connector
 * @typedef {Object} ConnectorState
 * @property {boolean} isLoggedIn - Flag wether the user is logged in.
 * @property {boolean} isOAuth - Flag wether the connector uses OAuth as authentication mechanism.
 * @property {string} username - Name used to log in.
 */

/**
 * Static infos of the connector
 * @typedef {Object} ConnectorStaticInfos
 * @property {string} name - ID of the connector. This will be use to select the connector in unifile.
 * @property {string} displayName - Name that should be display. Allows characters forbidden in name.
 * @property {string} icon - Path to an icon for this connector.
 * @property {string} description - Description of the connector.
 */

/**
 * Representation of a connector infos
 * @typedef {Object} ConnectorInfos
 * @todo Use ConnectorState and ConnectorStaticInfos docs
 * @property {string} name - ID of the connector. This will be use to select the connector in unifile.
 * @property {string} displayName - Name that should be display. Allows characters forbidden in name.
 * @property {string} icon - Path to an icon for this connector.
 * @property {string} description - Description of the connector.
 * @property {boolean} isLoggedIn - Flag wether the user is logged in.
 * @property {boolean} isOAuth - Flag wether the connector uses OAuth as authentication mechanism.
 * @property {string} username - Name used to log in.
 */

/**
 * Credentials of a service
 * @typedef {Object} Credentials
 *
 * For non-OAuth services
 * @property {string} [host] - URL to the service
 * @property {string} [port] - Port the auth service is listening to
 * @property {string} [user] - Username for the service
 * @property {string} [password] - Password for the service
 *
 * For OAuth services
 * @property {string} [code] - OAuth code for the service
 * @property {string} [state] - OAuth state for the service
 */

/**
 * Representation of a file
 * @typedef {Object} FileInfos
 * @property {string} name - Name of the file
 * @property {number} size - Size of the file in bytes
 * @property {string} modified - ISO string representation of the date from last modification
 * @property {boolean} isDir - Wether this is a directory or not
 * @property {string} mime - MIME type of this file
 */

const {UnifileError} = require('../error.js');

/**
 * Tells if a method needs authentification
 * @param {string} methodName - Name of the method to test
 * @return {boolean} true if the method needs to be authenticated
 * @private
 */
function isAuthentifiedFunction(methodName) {
   return ['readdir', 'mkdir', 'writeFile', 'createWriteStream',
      'readFile', 'createReadStream', 'rename', 'unlink', 'rmdir',
      'stat', 'batch'].includes(methodName);
}


function parsePath(path) {
   var segments = path.split("/"),
        connectorName = segments.splice(1,1)[0],
        path2 = segments.join("/");

   return {
      connectorName,
      path : path2
   };
}


function normalizeInfo(info,connectorName) {
   info.volumed = {
      volume :  connectorName,
      dirname : info.dirname,
      path : info.path
   };
   info.dirname = "/" + connectorName + info.dirname;
   info.path = "/" + connectorName + info.path;
}



const connectors = Symbol('connectors');

/**
 * VolumesConnector class
 * This will use connectors to distant services to manipulate the files.
 * An empty instance of VolumesConnector cannot connect to any service. You must first call the use() function
 * to register a connector.
 */
class VolumesConnector {

   /**
   * Create a new instance of VolumesConnector.
   * This will regroup all the connectors you decided to use.
   * @constructor
   */
   constructor() {
      this[connectors] = new Map();
   }


   // Auth methods are useless here

   getAuthorizeURL() {
      return Promise.resolve('');
   }

   setCredentials( token) {
      return Promise.resolve(token);
   }

   clearAccessToken(session) {
      return Promise.resolve();
   }

   login( loginInfos) {
      return new Promise.resolve();
   }
   
   /**
   * Adds a new connector into VolumesConnector.
   * Once a connector has been register with this function, it can be used with all the commands.
   * @param {Connector} connector - A connector implementing all of VolumesConnector functions
   */
   mount(connector) {
      if(!connector) throw new Error('Connector cannot be undefined');
      if(!connector.name) throw new Error('Connector must have a name');
      this[connectors].set(connector.name.toLowerCase(), connector);

      console.log("connector.name:" + connector.name);
   }

   // Infos commands

   /**
   * Get all the info you need about a connector
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {ConnectorInfos} all the infos about this connector
   */
   getInfos(session) {
      return Object.assign({
         isLoggedIn: true,
         isOAuth: false,
         username: process.env.USER
      }, this.infos);
   }

   /**
   * List all the connectors currently used in this instance of VolumesConnector
   * @return {string[]} an array of connectors names
   */
   listConnectors() {
      return Array.from(this[connectors].keys());
   }

   // Auth commands

   /**
   * Log a connector in a distant service.
   * This must be called before any access to the service or an error will be thrown.
   * The result of a successful login attempt will be saved in the session.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {Credentials|string} credentials - Service credentials (user/password or OAuth code)
   *  or a authenticated URL to connect to the service.
   * @return {external:Promise<string|null>} a promise of OAuth token if the service uses it or null
   */
   login( credentials,connectorName) {
      return this.callMethod(connectorName,  'login', credentials);
   }

   /**
   * Log a connector by directly using a OAuth token.
   * You don't have to call the method if you use the login() method. This is only in the case
   * you got a token from anothe source (CLI, app,...)
   * This must be called before any access to the service or an error will be thrown.
   * The result of a successful login attempt will be saved in the session.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {string} token - Service access token generated by OAuth
   * @return {external:Promise<string|null>} a promise of OAuth token if the service uses it or null
   */
   setCredentials(  token,connectorName,) {
      return this.callMethod(connectorName,  'setCredentials', token);
   }

   /**
   * Log out from a connector.
   * After that you won't be able to make any request until you log in again.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<null>} an empty promise.
   */
   clearAccessToken( connectorName) {
      return this.callMethod(connectorName,  'clearAccessToken');
   }

   /**
   * Get the URL of the authorization endpoint for an OAuth service.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<string>} a promise of the authorization URL
   */
   getAuthorizeURL( connectorName) {
      return this.callMethod(connectorName,  'getAuthorizeURL');
   }

   // Filesystem commands

   archive(connectorName,paths,to,options) {
      ///return this.callMethod(connectorName,  'createReadStream', path);
   }

   /**
   * copy a path
   */
   copy(srcPath, destPath) {
      var src = parsePath(srcPath),
          dest = parsePath(destPath);

      if (src.connectorName != dest.connectorName) {
         return Promise.reject(new Error("Invalid Operation"));
      }

      return this.callMethod(src.connectorName,  'copy', src.path,dest.path);      
   }


   /**
   * Create a read stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:ReadableStream} a readable stream from the file
   */
   createReadStream( path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'createReadStream', parsed.path);
   }

   /**
   * Create a write stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @return {external:WritableStream} a writable stream into the file
   */
   createWriteStream( path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'createWriteStream', parsed.path);
   }


   /**
   * Create a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to create. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise
   */
   mkdir( path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'mkdir', parsed.path);
   }

   /**
   * Move a path
   */
   move(srcPath, destPath) {
      var src = parsePath(srcPath),
          dest = parsePath(destPath);

      if (src.connectorName != dest.connectorName) {
         return Promise.reject(new Error("Invalid Operation"));
      }      

      return this.callMethod(src.connectorName,  'move', src.path,dest.path);      
   }

   quoat(connectorName) {
      return this.callMethod(connectorName,"quoat");
   }

   /**
   * Reads the content of a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to read. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos[]>} a promise of an array of FileInfos
   * @see {@link FileInfos} to get the properties of the return objects
   */
   readdir( path) {
      var parsed = parsePath(path);
      console.log("path:" + path);
      console.log("parsed:");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName,  'readdir', parsed.path).then(function(files){
         files.forEach(function(fileInfo){
            normalizeInfo(fileInfo,parsed.connectorName)
         });

         return files;
      });
   }

   /**
   * Read the content of the file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:Promise<string>} a promise of the content of the file
   */
   readFile( path) {
      var parsed = parsePath(path);
      var parsed = parsePath(path);
      console.log("readFile:path:" + path)
      console.log("readFile:parsed");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName,  'readFile', parsed.path);
   }

   /**
   * Give information about a file or directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the object to stat. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos>} a promise of FileInfos
   * @see {@link FileInfos} to get the properties of the return object
   */
   stat( path) {
      var parsed = parsePath(path);
      console.log("path:" + path);
      console.dir(parsed);
      return this.callMethod(parsed.connectorName,  'stat', parsed.path).then(function(info){
            normalizeInfo(info,parsed.connectorName)
            return info;
      });
   }


   /**
   * Write content to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @param {string} content - Content to write into the file
   * @return {external:Promise<null>} an empty promise.
   */
   writeFile( path, content) {
      var parsed = parsePath(path);
      console.log("writeFile:path:" + path)
      console.log("writeFile:parsed");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName,  'writeFile', parsed.path, content);
   }

   /**
   * Rename a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path to the file to rename. Must be relative to the root of the service.
   * @param {string} newName - New name to give to the file.
   * @return {external:Promise<null>} an empty promise.
   */
   rename( path, newName) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'rename', parsed.path, newName);
   }

   /**
   * Remove a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
   rmdir( path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'rmdir', parsed.path);
   }

   /**
   * Unlink (delete) a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
   unlink( path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName,  'unlink', parsed.path);
   }


   // Batch operation
   /**
   * Execute batch operation.
   * Available actions are UNLINK, RMDIR, RENAME, MKDIR and WRITEFILE.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @param {Object[]} actions - Array of actions to execute in this batch.
   * @param {string} actions[].name - Name of this action.
   * @param {string} actions[].path - Path parameter for this action.
   * @param {string} [actions[].destination] - Destination parameter for this action.
   * @param {string} [actions[].content] - Content parameter for this action.
   * @param {string} [message] - Message to describe this batch
   * @return {external:Promise<null>} an empty promise.
   */
   batch( connectorName, actions, message) {
      return this.callMethod(connectorName,  'batch', actions, message);
   }

   // Privates

   callMethod(connectorName,  methodName, ...params) {
      // Check connector
      if(!connectorName) throw new Error('You should specify a connector name!');
      const name = connectorName.toLowerCase();
      if(!this[connectors].has(name)) throw new Error(`Unknown connector: ${connectorName}`);
      const connector = this[connectors].get(name);
      if(!(methodName in connector)) throw new Error(`This connector does not implement ${methodName}()`);


      // Check authentification
      if(isAuthentifiedFunction(methodName) && !connector.getInfos().isLoggedIn)
         return Promise.reject(new UnifileError(UnifileError.EACCES, 'User not logged in.'));

      return connector[methodName]( ...params);
   }

   load(session) {
      this._session = session;
      const volumeNames = this.listConnectors();
      volumeNames.forEach((connectorName)=>{
          const connector = this[connectors].get(connectorName);
          this._session[connectorName] = this._session[connectorName] || {};
          if (connector.load) {
            connector.load(this._session[connectorName]);
          }

      });
   }
}


module.exports = VolumesConnector;
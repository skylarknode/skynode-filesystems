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

   getAuthorizeURL(session) {
      return Promise.resolve('');
   }

   setAccessToken(session, token) {
      return Promise.resolve(token);
   }

   clearAccessToken(session) {
      return Promise.resolve();
   }

   login(session, loginInfos) {
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
   login(session, credentials,connectorName) {
      return this.callMethod(connectorName, session, 'login', credentials);
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
   setAccessToken(session,  token,connectorName,) {
      return this.callMethod(connectorName, session, 'setAccessToken', token);
   }

   /**
   * Log out from a connector.
   * After that you won't be able to make any request until you log in again.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<null>} an empty promise.
   */
   clearAccessToken(session, connectorName) {
      return this.callMethod(connectorName, session, 'clearAccessToken');
   }

   /**
   * Get the URL of the authorization endpoint for an OAuth service.
   * @param {Object} session - Object where session data will be stored
   * @param {string} connectorName - Name of the connector
   * @return {external:Promise<string>} a promise of the authorization URL
   */
   getAuthorizeURL(session, connectorName) {
      return this.callMethod(connectorName, session, 'getAuthorizeURL');
   }

   // Filesystem commands

   archive(session,connectorName,paths,to,options) {
      ///return this.callMethod(connectorName, session, 'createReadStream', path);
   }

   /**
   * copy a path
   */
   copy(session,connectorName,srcPath, destPath) {
      var src = parsePath(srcPath),
          dest = parsePath(destPath);

      if (src.connectorName != dest.connectorName) {
         return Promise.reject(new Error("Invalid Operation"));
      }

      return this.callMethod(src.connectorName, session, 'copy', src.path,dest.path);      
   }


   /**
   * Create a read stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:ReadableStream} a readable stream from the file
   */
   createReadStream(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'createReadStream', parsed.path);
   }

   /**
   * Create a write stream to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @return {external:WritableStream} a writable stream into the file
   */
   createWriteStream(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'createWriteStream', parsed.path);
   }


   /**
   * Create a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to create. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise
   */
   mkdir(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'mkdir', parsed.path);
   }

   /**
   * Move a path
   */
   move(session,srcPath, destPath) {
      var src = parsePath(srcPath),
          dest = parsePath(destPath);

      if (src.connectorName != dest.connectorName) {
         return Promise.reject(new Error("Invalid Operation"));
      }      

      return this.callMethod(src.connectorName, session, 'move', src.path,dest.path);      
   }

   quoat(session,connectorName) {
      return this.callMethod(connectorName,session,"quoat");
   }

   /**
   * Reads the content of a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to read. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos[]>} a promise of an array of FileInfos
   * @see {@link FileInfos} to get the properties of the return objects
   */
   readdir(session, path) {
      var parsed = parsePath(path);
      console.log("path:" + path);
      console.log("parsed:");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName, session, 'readdir', parsed.path);
   }

   /**
   * Read the content of the file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to read. Must be relative to the root of the service.
   * @return {external:Promise<string>} a promise of the content of the file
   */
   readFile(session, path) {
      var parsed = parsePath(path);
      var parsed = parsePath(path);
      console.log("readFile:path:" + path)
      console.log("readFile:parsed");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName, session, 'readFile', parsed.path);
   }

   /**
   * Give information about a file or directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the object to stat. Must be relative to the root of the service.
   * @return {external:Promise<FileInfos>} a promise of FileInfos
   * @see {@link FileInfos} to get the properties of the return object
   */
   stat(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(connectorName, session, 'stat', path);
   }


   /**
   * Write content to a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to write. Must be relative to the root of the service.
   * @param {string} content - Content to write into the file
   * @return {external:Promise<null>} an empty promise.
   */
   writeFile(session, path, content) {
      var parsed = parsePath(path);
      console.log("writeFile:path:" + path)
      console.log("writeFile:parsed");
      console.dir(parsed);
      return this.callMethod(parsed.connectorName, session, 'writeFile', parsed.path, content);
   }

   /**
   * Rename a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path to the file to rename. Must be relative to the root of the service.
   * @param {string} newName - New name to give to the file.
   * @return {external:Promise<null>} an empty promise.
   */
   rename(session, path, newName) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'rename', parsed.path, newName);
   }

   /**
   * Remove a directory.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the directory to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
   rmdir(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'rmdir', parsed.path);
   }

   /**
   * Unlink (delete) a file.
   * @param {Object} session - Object where session data will be stored
   * @param {string} path - Path of the file to delete. Must be relative to the root of the service.
   * @return {external:Promise<null>} an empty promise.
   */
   unlink(session, path) {
      var parsed = parsePath(path);
      return this.callMethod(parsed.connectorName, session, 'unlink', parsed.path);
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
   batch(session, connectorName, actions, message) {
      return this.callMethod(connectorName, session, 'batch', actions, message);
   }

   // Privates

   callMethod(connectorName, session, methodName, ...params) {
      // Check connector
      if(!connectorName) throw new Error('You should specify a connector name!');
      const name = connectorName.toLowerCase();
      if(!this[connectors].has(name)) throw new Error(`Unknown connector: ${connectorName}`);
      const connector = this[connectors].get(name);
      if(!(methodName in connector)) throw new Error(`This connector does not implement ${methodName}()`);

      // Check session
      if(!session) throw new Error('No session provided');
      else if(!(name in session)) session[name] = {};

      // Check authentification
      if(isAuthentifiedFunction(methodName) && !connector.getInfos(session[name]).isLoggedIn)
         return Promise.reject(new UnifileError(UnifileError.EACCES, 'User not logged in.'));

      return connector[methodName](session[name], ...params);
   }
}


module.exports = VolumesConnector;
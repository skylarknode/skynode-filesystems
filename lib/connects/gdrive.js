'use strict';

const {PassThrough} = require('stream');
const Promise = require('bluebird');
const request = require('request');
const Mime = require('mime');
const nfs = require('skynode-nfs')

const {google} = require('googleapis');

const Tools = require('./tools');
const {UnifileError, BatchError} = require('../error');

const NAME = 'gdrive';

const SCOPES = [
       "https://www.googleapis.com/auth/drive",
       "https://www.googleapis.com/auth/drive.appdata",
       "https://www.googleapis.com/auth/drive.file",
       "https://www.googleapis.com/auth/drive.metadata",
       "https://www.googleapis.com/auth/drive.metadata.readonly",
       "https://www.googleapis.com/auth/drive.photos.readonly",
       "https://www.googleapis.com/auth/drive.readonly",
    ];

const charsToEncode = /[\u007f-\uffff]/g;



/**
 * Gdfs Path class.
 * @constructor
 * @param {string|undefined} pathname initial path.
 */
function GdfsPath(pathname) {
    this._lastSlash = true;
    this._absolute = true;
    this._paths = [];
    if(pathname != undefined) {
        this.parse(pathname);
    }
}


/**
 * Get a part of path.
 * @returns {GdfsPath} A path object including only path.
 */
GdfsPath.prototype.getPathPart = function() {
    if(this._lastSlash) {
        return new GdfsPath(this.toString());
    }
    const paths = this.elements();
    paths.splice(-1, 1, "");
    debug(`getPathPart: paths: ${JSON.stringify(paths)}`);
    return new GdfsPath(paths.join("/"));
};

/**
 * Get filename part of path.
 * @returns {string} A filename.
 */
GdfsPath.prototype.getFilename = function() {
    return this.elements().pop();
};

/**
 * Get paths elements.
 * @returns {Array<string>} the elements.
 */
GdfsPath.prototype.elements = function() {
    const elements = this._paths.map(item => item);
    if(this._absolute) {
        elements.unshift("");
    }
    if(this._lastSlash) {
        elements.push("");
    }
    return elements;
};

/**
 * Create a new path object with joining the two paths.
 * 
 * @param {Array<GdfsPath>} paths The paths to join.
 * @returns {GdfsPath} The path that was joined.
 */
GdfsPath.merge = (...paths) => {
    debug(`Gdfs.merge: ${paths.map(p=>p.toString()).join(" | ")}`);
    return paths.reduce( (pathA, pathB, index) => {
        debug(`Gdfs.merge: Reducing #${index}`);
        debug(`Gdfs.merge: pathA: ${pathA.toString()}`);
        debug(`Gdfs.merge: pathB: ${pathB.toString()}`);
        if(typeof(pathA) === "string") {
            pathA = new GdfsPath(pathA);
        }
        if(typeof(pathB) === "string") {
            pathB = new GdfsPath(pathB);
        }
        const a = pathA.toString();
        const b = pathB.toString();
        if(pathB.isAbsolute()) {
            debug(`returns ${b}`);
            return new GdfsPath(b);
        }
        const joined = new GdfsPath([a, b].join("/"));
        debug(`Gdfs.merge: returns ${joined.toString()}`);
        return joined;
    });
};

const split_path = pathname => {
    const paths = [];
    let escaped = false;
    let i = 0;
    let element = "";
    let chars = pathname.split("");
    while(i < chars.length) {
        const c = chars[i];
        if(escaped) {
            element += c;
            escaped = false;
        } else if(c === "\\"){
            escaped = true;
        } else if(c === "/") {
            paths.push(element);
            element = "";
        } else {
            element += c;
        }
        i++;
    }
    paths.push(element);
    if(escaped) {
        throw new Error(`Invalid pathname ${pathname}`);
    }
    if(paths.length == 0) {
        throw new Error("Invalid pathname. It should not be empty.");
    }
    return paths;
};

/**
 * Set a path repersented by a string.
 * @param {string} pathname A path name to parse
 * @return {undefined}
 */
GdfsPath.prototype.parse = function(pathname) {
    let paths = split_path(pathname.replace(/\/+/g, "/"));
    debug(`parse ${JSON.stringify(pathname)} => ${JSON.stringify(paths)}`);
    const lastSlash = (paths[paths.length - 1] === "");
    const absolute = (paths[0] === "");
    if(lastSlash) {
        paths.pop();
    }
    if(absolute) {
        paths.shift();
    }
    this._lastSlash = !!lastSlash;
    this._absolute = !!absolute;
    for(;;) {
        let replacement = false;
        if(paths.length >= 2) {
            paths = paths.reduce( (acc, next) => {
                if(!Array.isArray(acc)) {
                    acc = [acc];
                }
                const last = acc[acc.length - 1];
                if(last !== ".." && next === "..") {
                    acc.pop();
                    replacement = true;
                } else if(last !== "." && next === ".") {
                    replacement = true;
                } else {
                    acc.push(next);
                }
                return acc;
            });
        }
        if(!replacement) {
            this._paths = paths;
            debug(`this._paths:${JSON.stringify(this._paths)}`);
            break;
        }
    }
};

/**
 * Returns if this represents an absolute path.
 * @returns {Boolean} True if this represents an absolute path, otherwise false.
 */
GdfsPath.prototype.isAbsolute = function() {
    return this._absolute;
};

/**
 * Returns if this represents a directory.
 * @returns {Boolean} True if this represents a directory, otherwise false.
 */
GdfsPath.prototype.isDirSpec = function() {
    return this._lastSlash;
};

/**
 * Returns a path represented by string.
 * @returns {string} The path that this is representing.
 */
GdfsPath.prototype.toString = function() {
    if(this._paths.length === 0) {
        return "/";
    }
    const rootSpec = this._absolute ? "/" : "";
    const dirSpec = this._lastSlash ? "/" : "";
    const pathname = `${rootSpec}${this._paths.join("/")}${dirSpec}`;
    return pathname;
};

const oauth2Client = Symbol('oauth2Client');
const drive = Symbol()

function debug(s) {
    console.log(s);
}

const grest = {
};

/**
 * A mime type of the Google Drive's folder.
 * @type {string}
 */
grest.mimeTypeFolder = "application/vnd.google-apps.folder";

/**
 * Get actual root folder id.
 * @async
 * @return {Promise<string>} The root folder's id
 */
grest.getActualRootFolderId = async (credentials) => {
    ///const res = await grest.getFileResource(session,{ fileId: "root", fields: "id" });
    ///debug(`getActualRootFolderId: res ${JSON.stringify(res, null, "  ")}`);
    ///return res.id;
    return "root";
};



/**
 * Check if the file is a folder.
 * @param {object} file The file object provided from the result
 * of `getFileList` method.
 * @returns {boolean} The file is a folder or not.
 */
grest.isFolder =  function(file) {
    return file.mimeType === grest.mimeTypeFolder;
};

/**
 * Get a file content as text from Google Drive.
 * Even if the file is not a text actually, it could be converted
 * to ArrayBuffer, Blob or JSON to use by Web App.
 * @param {string} fileId The file id to download.
 * @param {boolean|null} acknowledgeAbuse A user acknowledgment
 * status for the potential to abuse. This parameter is optional.
 * default value is false.
 * @returns {Promise<string>} A downloaded content as text.
 */
grest.downloadFile = async function (credentials,fileId, acknowledgeAbuse) {
    return grest.requestWithAuth(credentials,"GET",
        "https://www.googleapis.com/drive/v3/files/"+fileId,
        { alt: "media", acknowledgeAbuse : acknowledgeAbuse });
};

/**
 * Create a new file's resource.
 * @param {string} folderId The folder id where the file is created.
 * @param {string} filename The file name.
 * @param {string} mimeType The mime type for the new file.
 * @returns {Promise<object>} The response of the API.
 */
grest.createFile = async function (credentials,folderId, filename, mimeType){
    const response = await grest.requestWithAuth(credentials,"POST",
        "https://www.googleapis.com/drive/v3/files", {},
        { "Content-Type": "application/json", },
        JSON.stringify({
            name: filename,
            mimeType: mimeType,
            parents: [folderId],
        }));
    return JSON.parse(response);
};

/**
 * Upload a file content to update a existing file.
 * @param {string} fileId The file id to update.
 * @param {string} mimeType The content type of the file.
 * @param {any} data The file content.
 * @returns {Promise<object>} The response of the API.
 */
grest.updateFile = async (credentials,fileId, mimeType, data) => {
    const response = await grest.requestWithAuth(credentials,"PATCH",
        "https://www.googleapis.com/upload/drive/v3/files/"+fileId,
        { uploadType: "media" },
        { "Content-Type": mimeType },
        data);
    return JSON.parse(response);
};

/**
 * @param {string} method The request method.
 * @param {string} endpoint The endpoint of API.
 * @param {object} queryParams The query parameters.
 * @param {object} headers The request headers.
 * @param {any} body The request body.
 * @returns {Promise<object>} The response of the request.
 */
grest.requestWithAuth =  function (credentials,method, endpoint, queryParams, headers, body){
    let xhr = new XMLHttpRequest();
    xhr.open(method, createUrl(endpoint, queryParams), true);
    headers = headers || {};
    Object.keys(headers).forEach( name => {
        xhr.setRequestHeader(name, headers[name]);
    });
    xhr.setRequestHeader("Authorization",
        "Bearer " + credentials.access_token);
    xhr.timeout = 30000;
    return new Promise( (resolve, reject) => {
        xhr.onload = () => { resolve(xhr.responseText); };
        xhr.onerror = () => { reject(new Error(xhr.statusText)); };
        xhr.ontimeout = () => { reject(new Error("request timeout")); };
        xhr.send(body);
    });
};

grest.toUnifiedFileInfo = function(file,path) {
    const info = Object.assign(file);

    info.path = path;
    info.isDir = grest.isFolder(file);
    if (info.isDir) {
        info.mimeType = "application/directory";
    }
    info.dirname = nfs.dirname(path);

    return info;
}

/**
 * Create URI including query parameters.
 * @param {string} endpoint The endpoint of API.
 * @param {object|null} params The query parameters.
 * @returns {string} The URI.
 */
const createUrl = (endpoint, params) => {
    if(params == null) {
        return endpoint;
    }
    let keys = Object.keys(params).filter(
        key => (key !== ""));
    if(keys.length == 0) {
        return endpoint;
    }
    let queryString = keys.map( key => {
        let value = params[key];
        return (value == null ? null : `${key}=${encodeURI(value)}`);
    }).join("&");
    return `${endpoint}?${queryString}`;
};



/**
 * Service connector for {@link https://dropbox.com|Dropbox} plateform.
 *
 * This will need a registered Dropbox application with valid redirection for your server.
 * You can register a new application {@link https://www.dropbox.com/developers/apps|here} and
 * learn more about Dropbox OAuth Web application flow
 * {@link https://www.dropbox.com/developers/reference/oauth-guide|here}
 */
class GoogleDriveConnector {

	/**
	 * @constructor
	 * @param {Object} config - Configuration object
	 * @param {string} config.redirectUri - Dropbox application redirect URI
	 * @param {string} config.clientId - Dropbox application client ID
	 * @param {string} config.clientSecret - Dropbox application client secret
	 * @param {string} [config.writeMode=overwrite] - Write mode when files conflicts. Must be one of
	 * 	'add'/'overwrite'/'update'.
	 * {@link https://www.dropbox.com/developers/documentation/http/documentation#files-upload|see Dropbox manual}
	 * @param {ConnectorStaticInfos} [config.infos] - Connector infos to override
	 */
	constructor(config,session) {
		if(!config || !config.clientId || !config.clientSecret || !config.redirectUri)
			throw new Error('Invalid configuration. Please refer to the documentation to get the required fields.');
		this.redirectUri = config.redirectUri;
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;

		this.infos = Tools.mergeInfos(config.infos, {
			name: NAME,
			displayName: 'GoogleDrive',
			icon: '../assets/gdrive.png',
			description: 'Edit files from your Google Drive.'
		});

		this.name = this.infos.name;
		if(!config.writeMode || ['add', 'overwrite', 'update'].every((mode) => mode !== config.writeMode))
			this.writeMode = 'overwrite';
		else this.writeMode = config.writeMode;

        /**
         * Create a new OAuth2 client with the configured keys.
         */
        this.client = new google.auth.OAuth2(
          this.clientId,
          this.clientSecret,
          this.redirectUri
        );

        if (session) {
            this.load(session);
        } else {
            this.session = {};
        }
	}

    load(session) {
        this.session = session;

        if (session.credentials) {
            this.setCredentials(session.credentials);
        }
    }

	getInfos() {
        const session = this.session;
		return Object.assign({
			isLoggedIn: (session && 'credentials' in session),
			isOAuth: true,
			username: session.account ? session.account.name.display_name : undefined
		}, this.infos);
	}

	setCredentials(credentials) {
		///session.tokens = tokens;
        this.session.credentials = credentials;

		console.log("credentials:\n");
		console.dir(credentials);
		this.client.credentials = credentials;

        ///this.session = {};
        ///this.session.auth = this.client;
        this.drive = google.drive({version: 'v3', auth:this.client});

	}

	clearAccessToken() {
		this.session = {}
		return Promise.resolve();
	}

	getAuthorizeURL() {


		/**
		 * This is one of the many ways you can configure googleapis to use authentication credentials.  In this method, we're setting a global reference for all APIs.  Any other API you use here, like google.drive('v3'), will now use this auth client. You can also override the auth client at the service and method call levels.
		 */
		google.options({auth: this.client});

	    const url = this.client.generateAuthUrl({
	      access_type: 'offline',
	      scope: SCOPES.join(' '),
	    });

		return Promise.resolve(url);
	}

	login(loginInfos) {
		let returnPromise;

		console.log("loginInfos\n");
		console.dir(loginInfos);

		function processResponse(resolve, reject, err, response, body) {
			if(err) return reject('Error while calling Dropbox API. ' + err);
			session.account = {id: body.account_id};
			return resolve(body.access_token);
		}

		///if(typeof loginInfos === 'object' && 'state' in loginInfos && 'code' in loginInfos) {
		///	if(loginInfos.state !== session.state)
		///		return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid request (cross-site request)'));
		if(typeof loginInfos === 'object' && 'code' in loginInfos) {
			returnPromise = new Promise((resolve, reject) => {
				try {
            		///const {tokens} = await oauth2Client.getToken(loginInfos.code);
            		///resolve(tokens);
            	    this.client.getToken(loginInfos.code).then(function(result){
                        resolve(result.tokens)
                    },reject);
        		} catch (e) {
          			reject(e);
        		}
			});
		} else {
			return Promise.reject(new UnifileError(UnifileError.EACCES, 'Invalid credentials'));
		}
		return returnPromise.then((credentials) => {
			return this.setCredentials(credentials);
		});
	}

	//Filesystem commands
/*
    async function cloneFolder(from, to){
     // Create new folder
     const newFolder = (await gapi.client.drive.files.create({
      resource: {
        name: from.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [to.id]
      }
     })).result
     // Find all sub-folders
     const folders = (await gapi.client.drive.files.list({
      q: `'${from.id}' in parents and mimeType =  'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name)'
     })).result.files
     // Find all files 
     const files = (await gapi.client.drive.files.list({
      q: `'${from.id}' in parents and mimeType !=   'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name)'
     })).result.files
     files.forEach(async file => {
      // Create Copy of File
      const cloned = (await gapi.client.drive.files.copy({
        fileId: file.id
      })).result
      // Move copy to new folder
      await gapi.client.drive.files.update({
        fileId: cloned.id,
        addParents: newFolder.id,
        removeParents: from.id,
        resource: { name: file.name },
        fields: 'id, parents'
      })
     })
     // Recursion
     folders.forEach(folder => cloneFolder(folder, newFolder, false))
    }
*/
    async copy(src,dest,options) { // only file TODO: support for dir
        debug(`copy (${src},${dest})`);
        const srcAbsPath = this.toAbsolutePath(new GdfsPath(src));
        const srcParentFolder = await this.getFileOfPath(srcAbsPath.getPathPart());
        debug(`copy: srcParentFolder ${JSON.stringify(srcParentFolder)}`);
        if(!srcParentFolder || srcParentFolder.id == null) {
            debug(`copy: The path not exists ${src}`);
            return null;
        }
        const srcPathName = srcAbsPath.getFilename();
        debug(`copy: srcPathName: ${srcPathName}`);
        const srcFiles = await this.findFileByName(srcParentFolder.id, srcPathName);
        debug(`copy: srcFiles: ${JSON.stringify(srcFiles)}`);
        if(srcFiles.length === 0) {
            debug(`move: The file not exists ${src}`);
            return null;
        }
        const srcFile = srcFiles.shift();


        const destAbsPath = this.toAbsolutePath(new GdfsPath(dest));
        const destParentFolder = await this.getFileOfPath(destAbsPath.getPathPart());
        debug(`copy: destParentFolder ${JSON.stringify(destParentFolder)}`);
        if(!destParentFolder || destParentFolder.id == null) {
            debug(`move: The dest folder not exists ${dest}`);
            return null;
        }
        const destPathName = destAbsPath.getFilename();
        debug(`copy: destPathName: ${destPathName}`);
        const destFiles = await this.findFileByName(destParentFolder.id, destPathName);
        debug(`copy: destFiles: ${JSON.stringify(destFiles)}`);
        if(destFiles.length > 0) {
            debug(`move: The file  exists ${dest}`);
            return null;
        }


        // Create Copy of File
        const cloned = (await this.drive.files.copy({
            fileId: srcFile.id
        })).data;

        console.log("cloned:");
        console.dir(cloned);

        let params = {
            fileId: cloned.id,
            resource: { name: destPathName },
            fields: 'id, parents'
        };

        if (srcParentFolder.id !== destParentFolder.id) {
            params.addParents = destParentFolder.id;
            params.removeParents = srcParentFolder.id;
        }

        const response = await this.drive.files.update(params);

        const result = response.result;

        return result;
    }

    /**
     * Check the path is a directory.
     * @async
     * @param {GdfsPath} path A path to check
     * @returns {Promise<Boolean>} The path is a directory or not.
     */
    async isDirectory (path) {
      debug("No tests pass: Gdfs#isDirectory");
      const file = await this.getFileOfPath(path);

      if (!file) {
        return false;
      }

      return file.mimeType === grest.mimeTypeFolder;
    }

    /**
     * Find a folder by name from a folder.
     * @async
     * @param {string} parentFolderId A parent folder id.
     * @param {string} folderName A folder name to find
     * @returns {Array<object>} A folder list that found.
     */
    async  findFolderByName (parentFolderId, folderName) {
        debug("No tests pass: findFolderByName");
        const folders = [];
        const q = [
            `parents in '${parentFolderId}'`,
            `name = '${folderName}'`,
            `mimeType = '${grest.mimeTypeFolder}'`,
            "trashed = false",
        ].join(" and ");

        const params = {
            "pageSize": 10,
            "pageToken": null,
            "q": q,
            "fields": "nextPageToken, " +
                      "files(id, name, mimeType,createdTime,size,modifiedTime, webContentLink, webViewLink)",
        };

        debug(`${JSON.stringify(params)}`);
        try {
            do {
                const result = (await this.drive.files.list(params)).data;
                debug(`${JSON.stringify(result)}`);
                for(const file of result.files) {
                    folders.push(file);
                }
                params.pageToken = result.nextPageToken;
            } while(params.pageToken != null);
        } catch(err) {
            debug(err.stack);
        }

        return folders;
    }

    /**
     * Find a file by name from a folder.
     * @async
     * @param {string} parentFolderId A parent folder id.
     * @param {string} fileName A file name to find
     * @returns {Promise<Array<object> >} A folder list that found.
     */
    async findFileByName(parentFolderId, fileName,options){
        debug("No tests pass: findFileByName");
        options = options || {}
        const files = [];
        const conds = [
            `parents in '${parentFolderId}'`,
            `name = '${fileName}'`
        ];
        if (!options.trashed) {
            conds.push("trashed = false");
        }

        const params = {
            "pageSize": 10,
            "pageToken": null,
            "q": conds.join(" and "),
            "fields": "nextPageToken, " +
                      "files(id, name, mimeType,createdTime,size,modifiedTime, webContentLink, webViewLink)",
        };

        debug(`findFileByName: params: ${JSON.stringify(params, null, "  ")}`);
        do {
            const result = (await this.drive.files.list(params)).data;
            for(const file of result.files) {
                debug(`findFileByName: found file: ${JSON.stringify(file)}`);
                files.push(file);
            }
            debug(`findFileByName: result.nextPageToken: ${result.nextPageToken}`);
            params.pageToken = result.nextPageToken;
        } while(params.pageToken != null);

        return files;
    }



    /**
     * Get an array of path element from root directory.
     * @async
     * @param {GdfsPath} path path object.
     * @returns {Promise<Array<object> >} the array of the object having an id and
     *      the name.
     */
    async getPaths (path) {
      debug("No tests pass: Gdfs#getPaths");
      debug(`getPaths(${path})`);

      ///if (!path.isAbsolute()) {
      ///  debug("getPaths: Error: the path must be absolute");
      ///  return null;
      //}

      const paths = [{
        id: "root",
        name: "",
        mimeType: grest.mimeTypeFolder
      }];

      for (const name of path.elements().slice(1)) {
        if (name === "") {
          break;
        }

        const parent = paths.slice(-1)[0];
        debug(`name: ${name}, parent: ${JSON.stringify(parent)}`);
        const path = {
          id: null,
          name: null,
          mimeType: null
        };

        if (parent.id != null) {
          const children = await this.findFileByName(parent.id, name);

          if (children.length > 0) {
            const child = children.shift();
            path.id = child.id;
            path.name = child.name;
            path.mimeType = child.mimeType;
          }
        }

        paths.push(path);
      }

      debug(`getPaths: ${JSON.stringify(paths, null, "  ")}`);
      return paths;
    }

    /**
     * Get the file object that the path points to.
     * @param {GdfsPath} path the path.
     * @returns {file} the file object of google drive.
     */
    async getFileOfPath (path) {
      const paths = await this.getPaths(path);

      if (!paths) {
        return null;
      }

      return paths.slice(-1)[0];
    }

	/**
	 * Make a directory.
	 * @async
	 * @param {string} path A pathname to operate.
	 * @returns {Promise<object>} The API response.
	 */
	async mkdir(path) {
	    debug(`mkdir(${path})`);

	    path = path.replace(/\/+$/, "");
	    const absPath = this.toAbsolutePath(new GdfsPath(path));
	    const parentFolder = await this.getFileOfPath(absPath.getPathPart());
	    debug(`mkdir: parentFolder ${JSON.stringify(parentFolder)}`);
	    if(!parentFolder || parentFolder.id == null) {
	        debug(`mkdir: The path not exists ${path}`);
	        return null;
	    }
	    const pathname = absPath.getFilename();
	    debug(`mkdir: pathname: ${pathname}`);
	    const files = await this.findFileByName(parentFolder.id, pathname);
	    debug(`mkdir: files: ${JSON.stringify(files)}`);
	    if(files.length > 0) {
	        debug(`mkdir: The directory exists ${path}`);
	        return null;
	    }
	    const result = await grest.createFile(this.session.tokens, parentFolder.id, pathname, grest.mimeTypeFolder);
	    ///if(parentFolder.id === this.getCurrentFolderId()) {
	    ///    await this.fireCwdUpdate();
	    ///}
	    return result;
	}


    /**
     * Move a file from src path to dest path.
     *
     */
    async move( src, dest) {
        debug(`move (${src},${dest})`);
        const srcAbsPath = this.toAbsolutePath(new GdfsPath(src));
        const srcParentFolder = await this.getFileOfPath(srcAbsPath.getPathPart());
        debug(`move: srcParentFolder ${JSON.stringify(srcParentFolder)}`);
        if(!srcParentFolder || srcParentFolder.id == null) {
            debug(`move: The path not exists ${src}`);
            return null;
        }
        const srcPathName = srcAbsPath.getFilename();
        debug(`move: srcPathName: ${srcPathName}`);
        const srcFiles = await this.findFileByName(srcParentFolder.id, srcPathName);
        debug(`move: srcFiles: ${JSON.stringify(srcFiles)}`);
        if(srcFiles.length === 0) {
            debug(`move: The file not exists ${src}`);
            return null;
        }
        const srcFile = srcFiles.shift();


        const destAbsPath = this.toAbsolutePath(new GdfsPath(dest));
        const destParentFolder = await this.getFileOfPath(destAbsPath.getPathPart());
        debug(`move: destParentFolder ${JSON.stringify(destParentFolder)}`);
        if(!destParentFolder || destParentFolder.id == null) {
            debug(`move: The dest folder not exists ${dest}`);
            return null;
        }
        const destPathName = destAbsPath.getFilename();
        debug(`move: destPathName: ${destPathName}`);
        const destFiles = await this.findFileByName(destParentFolder.id, destPathName);
        debug(`move: destFiles: ${JSON.stringify(destFiles)}`);
        if(destFiles.length > 0) {
            debug(`move: The file  exists ${dest}`);
            return null;
        }

        let params = {
            fileId: srcFile.id
        };

        if (srcParentFolder.id !== destParentFolder.id) {
            params.addParents = destParentFolder.id;
            params.removeParents = srcParentFolder.id;
        }

        if (srcPathName != destPathName) {
            params.requestBody = {
                "name" : destPathName
            };
        }

        const response = await this.drive.files.update(params);

        const result = response.result;
        ///if(parentFolder.id === this.getCurrentFolderId()) {
        ///    await this.fireCwdUpdate();
        ///}
        return result;
    }

    /**
     * rename a file.
     *
     * @param {String} fileId <span style="font-size: 13px; ">ID of the file to rename.</span><br> * @param {String} newTitle New title for the file.
     */
    async rename( path, newName) {
        debug(`rename(${path})`);
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`remove: parentFolder ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`rename: The path not exists ${path}`);
            return null;
        }
        const pathname = absPath.getFilename();
        debug(`rename: pathname: ${pathname}`);
        const files = await this.findFileByName(parentFolder.id, pathname);
        debug(`rename: files: ${JSON.stringify(files)}`);
        if(files.length === 0) {
            debug(`rename: The file not exists ${path}`);
            return null;
        }
        const file = files.shift();
        if(file.mimeType === grest.mimeTypeFolder) {
            debug(`rename: The file is a folder ${path}`);
            return null;
        }


        const response = await this.drive.files.update({ 
            fileId: file.id, 
            requestBody: {
                name: newName
            }
        });
        const result = response.result;
        ///if(parentFolder.id === this.getCurrentFolderId()) {
        ///    await this.fireCwdUpdate();
        ///}
        return result;

    }

    /**
     * Read the directory to get a list of filenames.
     *
     * This method may not returns all files in the directory.
     * To know all files were listed, check the `pageToken` field in the parameter
     * `options` after the invocation.
     * If the reading was completed, the field would be set `null`.
     * The rest files unread will be returned at the next invocation with same
     * parameters.
     *
     * ```javascript
     * const readDirAll = async path => {
     *     const opts = { pageSize: 10, pageToken: null };
     *     const files = [];
     *     do {
     *        for(const fn of await files.readdir(path, opts)) {
     *            files.push(fn);
     *        }
     *     } while(opts.pageToken != null);
     * };
     * ```
     *
     * @async
     * @since v1.1.0
     * @param {string} path A path to the directory.
     *
     * @param {object|null} options (Optional) options for this method.
     *
     * Only two fields are available:
     *
     * * "pageSize": Set maximum array size that this method returns at one
     * time.  The default value 10 will be used if this is not specified or
     * zero or negative value is specified.
     * * "pageToken": Set null to initial invocation to read from first
     * entry. This would be updated other value if the unread files are
     * remained. The value is used for reading next files. User should not
     * set the value except for null.
     *
     * If this parameter is ommited, all files will be read.
     * This is not recomended feature for the directory that has a number of files.
     *
     * @returns {Promise<Array<string> >} returns an array of filenames.
     */
    async readdir(path,options) {
        path += path.match(/\/$/) ? "" : "/";
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        ///const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`readdir: parentFolder: ${JSON.stringify(parentFolder)}`);

        if(!parentFolder || parentFolder.id == null) {
            debug(`readdir: The path not exists ${path}`);
            return null;
        }

        if(!grest.isFolder(parentFolder)) {
            debug(`readdir: The path is not a folder ${path}`);
            return null;
        }

        const files = [];
        const readAll = (options == null);
        options = options || {};
        const pageSize = options.pageSize || 10;
        let pageToken = options.pageToken || null;

        const readFiles = async params => {
            debug(`readdir: params: ${JSON.stringify(params, null, "  ")}`);
            const result = (await this.drive.files.list(params)).data;
            debug(`readdir: result.nextPageToken: ${result.nextPageToken}`);
            for(const file of result.files) {
                files.push(grest.toUnifiedFileInfo(file,path));
            }
            return result.nextPageToken;
        };

        const params = {
            "pageSize": pageSize <= 0 ? 10 : pageSize,
            "pageToken": pageToken,
            "q": `parents in '${parentFolder.id}' and trashed = false`,
            "fields": "nextPageToken, files(id, name, mimeType,createdTime,size,modifiedTime)",
        };

        if(!readAll) {
            // eslint-disable-next-line require-atomic-updates
            options.pageToken = await readFiles(params);
        } else {
            do {
                // eslint-disable-next-line require-atomic-updates
                params.pageToken = await readFiles(params);
            } while(params.pageToken != null);
        }

        debug(`readdir: files: ${JSON.stringify(files)}`);
        return files;

    }

	/**
	 * Read a file.
	 * The file must have webContentLink in its resource to read the contents,
	 * To get the resource, Use [`Gdfs#stat`](#stat).
	 *
	 * @async
	 * @param {string} path A pathname to operate.
	 * @returns {Promise<string>} The file content.
	 */
	async readFile(path) {
	    debug(`Gdfs#readFile(${path})`);
	    const absPath = this.toAbsolutePath(new GdfsPath(path));
	    const parentFolder = await this.getFileOfPath(absPath.getPathPart());
	    debug(`readFile: parentFolder: ${JSON.stringify(parentFolder)}`);
	    if(!parentFolder || parentFolder.id == null) {
	        debug(`readFile: The path not exists ${path}`);
	        return null;
	    }
	    const filename = absPath.getFilename();
	    debug(`readFile: filename: ${filename}`);
	    const files = await this.findFileByName(parentFolder.id, filename);
	    debug(`readFile: files: ${JSON.stringify(files)}`);
	    if(files.length === 0) {
	        debug(`File not found ${path}`);
	        return null;
	    }
	    const file = files.shift();
	    if(!file.webContentLink) {
	        debug(`File is not downloadable ${path}`);
	        return null;
	    }
	    return await grest.downloadFile(this.session.tokens,file.id);
	}


	/**
	 * Remove the directory but not a normal file.
	 * The operation will fail, if it is not a directory nor empty.
	 * @async
	 * @param {string} path A pathname to operate.
	 * @returns {Promise<object|null>} Returns the API response.
	 *      null means it was failed.
	 */
	async rmdir( path) {
	    debug(`rmdir(${path})`);
	    path = path.replace(/\/+$/, "");
	    const absPath = this.toAbsolutePath(new GdfsPath(path));
	    const parentFolder = await this.getFileOfPath(absPath.getPathPart());
	    debug(`rmdir: parentFolder ${JSON.stringify(parentFolder)}`);
	    if(!parentFolder || parentFolder.id == null) {
	        debug(`rmdir: The path not exists ${path}`);
	        return null;
	    }
	    const pathname = absPath.getFilename();
	    debug(`rmdir: pathname: ${pathname}`);
	    if(pathname === "") {
	        debug(`rmdir: The root directory cannot be removed ${path}`);
	        return null;
	    }
	    const dires = await this.findFolderByName(parentFolder.id, pathname);
	    debug(`rmdir: dires: ${JSON.stringify(dires)}`);
	    if(dires.length === 0) {
	        debug(`rmdir: The directory not exists ${path}`);
	        return null;
	    }
	    const dir = dires.shift();
	    debug(`rmdir: dir ${JSON.stringify(dir)}`);
	    ///if(this._currentPath.filter(parent => parent.id == dir.id).length > 0 ||
	    ///    dir.id === await grest.getActualRootFolderId())
        if (dir.id === await grest.getActualRootFolderId(this.session.tokens))
	    {
	        debug(`rmdir: The path is a parent ${path}`);
	        return null;
	    }
	    if(dir.mimeType !== grest.mimeTypeFolder) {
	        debug(`rmdir: The path is not folder ${path}`);
	        return null;
	    }
	    const params = {
	        "q": `parents in '${dir.id}' and trashed = false`,
	        "fields": "files(id)",
	    };
	    debug(`rmdir: params ${JSON.stringify(params)}`);
	    const children = (await this.drive.files.list(params)).data;
	    debug(`rmdir: children: ${JSON.stringify(children, null, "  ")}`);
	    if(children.files.length > 0) {
	        debug(`rmdir: The folder is not empty ${path}`);
	        return null;
	    }
	    const response = await this.drive.files.delete(
	        { fileId: dir.id });
	    ///if(parentFolder.id === this.getCurrentFolderId()) {
	    ///    await this.fireCwdUpdate();
	    ///}
	    return response.result;
    }

    /**
     * trash a file.
     *
     */
    async trash( path) {
        debug(`unlink(${path})`);
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`trash: parentFolder ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`trash: The path not exists ${path}`);
            return null;
        }
        const pathname = absPath.getFilename();
        debug(`trash: pathname: ${pathname}`);
        const files = await this.findFileByName(parentFolder.id, pathname);
        debug(`trash: files: ${JSON.stringify(files)}`);
        if(files.length === 0) {
            debug(`trash: The file not exists ${path}`);
            return null;
        }

        const response = await this.drive.files.update({ 
            fileId: file.id, 
            requestBody: {
                trashed: true
            }
        });
        const result = response.result;
        return result;
    }

    /**
     * Get file's properties.
     * It is a file resource of Google Drive including id, name, mimeType,
     * webContentLink and webViewLink about the file or directory.
     *
     * @async
     * @param {string} path A pathname.
     * @returns {File} The file resource of Google Drive including id, name,
     *      mimeType, webContentLink and webViewLink about the file or directory.
     * @since v1.1.0
     */
    async stat(path) {
        debug(`Gdfs#stat(${path})`);
        path = path.replace(/\/+$/, "");
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        debug(`stat: absPath: ${absPath.toString()}`);
        path = absPath.toString();
        if(path === "/") {
            const res = await this.drive.files.get({
                fileId: "root",
                fields: "id, name, mimeType,createdTime,size,modifiedTime, webContentLink, webViewLink",
            });
            debug(`stat: file ${JSON.stringify(res)}`);
            return grest.toUnifiedFileInfo(res.result,path);
        }
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`stat: parentFolder: ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`stat: The path not exists ${path}`);
            return null;
        }
        const filename = absPath.getFilename();
        debug(`stat: filename: ${filename}`);
        const files = await this.findFileByName(parentFolder.id, filename);
        if(files.length === 0) {
            debug(`stat: File not found ${path}`);
            return null;
        }
        const file = files.shift();
        debug(`stat: file ${JSON.stringify(file)}`);
        return grest.toUnifiedFileInfo(file,path);
    }


    toAbsolutePath(path) {
        return path;
    }

    /**
     * Delete the file but not directory.
     * This does not move the file to the trash-box.
     *
     * @async
     * @param {string} path A pathname to operate.
     * @returns {Promise<object|null>} Returns the API response.
     *      null means it was failed.
     */
    async unlink( path) {
        debug(`unlink(${path})`);
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`unlink: parentFolder ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`unlink: The path not exists ${path}`);
            return null;
        }
        const pathname = absPath.getFilename();
        debug(`unlink: pathname: ${pathname}`);
        const files = await this.findFileByName(parentFolder.id, pathname);
        debug(`unlink: files: ${JSON.stringify(files)}`);
        if(files.length === 0) {
            debug(`unlink: The file not exists ${path}`);
            return null;
        }
        const file = files.shift();
        if(file.mimeType === grest.mimeTypeFolder) {
            debug(`unlink: The file is a folder ${path}`);
            return null;
        }
        const response = await this.drive.files.delete({ fileId: file.id });
        const result = response.result;
        ///if(parentFolder.id === this.getCurrentFolderId()) {
        ///    await this.fireCwdUpdate();
        ///}
        return result;
    }

    /**
     * untrash a file.
     *
     */
    async untrash( path) {
        debug(`unlink(${path})`);
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`untrash: parentFolder ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`trash: The path not exists ${path}`);
            return null;
        }
        const pathname = absPath.getFilename();
        debug(`trash: pathname: ${pathname}`);
        const files = await this.findFileByName(parentFolder.id, pathname,{
            trashed : true
        });
        debug(`untrash: files: ${JSON.stringify(files)}`);
        if(files.length === 0) {
            debug(`untrash: The file not exists ${path}`);
            return null;
        }

        const response = await this.drive.files.update({ 
            fileId: file.id, 
            requestBody: {
                trashed: false
            }
        });
        const result = response.result;
        return result;
    }

    /**
     * Write a file.
     * @async
     * @param {string} path A pathname to operate.
     * @param {string} mimeType A mimeType of the file content.
     * @param {string} data A file content.
     * @returns {Promise<object>} The API response.
     */
    async writeFile( path, data,mimeType) {
        mimeType = mimeType || "txt/plain";
        debug(`Gdfs#writeFile(${path},${mimeType}, ${JSON.stringify(data)})`);
        const absPath = this.toAbsolutePath(new GdfsPath(path));
        const parentFolder = await this.getFileOfPath(absPath.getPathPart());
        debug(`writeFile: parentFolder: ${JSON.stringify(parentFolder)}`);
        if(!parentFolder || parentFolder.id == null) {
            debug(`writeFile: The path not exists ${path}`);
            return null;
        }
        const filename = absPath.getFilename();
        debug(`writeFile: filename: ${filename}`);
        const files = await this.findFileByName(parentFolder.id, filename);
        debug(`writeFile: files: ${JSON.stringify(files)}`);
        if(files.length === 0) {
            const file = await grest.createFile(this.session.tokens,parentFolder.id, filename, mimeType);
            const result = await grest.updateFile(this.session.tokens,file.id, mimeType, data);
            ///if(parentFolder.id === this.getCurrentFolderId()) {
            ///    await this.fireCwdUpdate();
            ///}
            return result;
        }
        const file = files.shift();
        if(file.mimeType === grest.mimeTypeFolder) {
            debug(`writeFile: The path already exists as directory ${path}`);
            return null;
        }
        const result = await grest.updateFile(this.session.tokens,file.id, mimeType, data);
        ///if(parentFolder.id === this.getCurrentFolderId()) {
        ///    await this.fireCwdUpdate();
        ///}
        return result;
    }
}

///GoogleDriveConnector.name = "gdrive";

module.exports = GoogleDriveConnector;

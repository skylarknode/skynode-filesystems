'use strict';

const Path = require('path');
const PassThrough = require('stream').PassThrough;

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const Unifile = require('../../lib/index');

const app = express();
const volumesRouter = express.Router()

app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
	secret: 'ufs',
	resave: false,
	saveUninitialized: false
}));

app.use("/volumes",volumesRouter)

// Configure connectors
const ghconnector = new Unifile.connects.GitHubConnector({
	clientId: 'b4e46028bf36d871f68d',
	clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78',
	redirectUri : "http://localhost:6805/volumes/github/oauth-callback"
});
const dbxconnector = new Unifile.connects.DropboxConnector({
	clientId: '37mo489tld3rdi2',
	clientSecret: 'kqfzd11vamre6xr',
	redirectUri: 'http://localhost:6805/volumes/dropbox/oauth-callback'
});
const ftpconnector = new Unifile.connects.FtpConnector({redirectUri: 'http://localhost:6805/ftp/signin'});
///const wdconnector = new Unifile.WebDavConnector({redirectUri: 'http://localhost:6805/webdav/signin'});
const rsconnector = new Unifile.connects.HttpConnector({
	redirectUri: 'http://localhost:6805/volumes/http/callback'
});
const lsconnector = new Unifile.connects.LocalConnector({
	mappedRealFolder : "C:\\tmp",
	redirectUri: 'http://localhost:6805/volumes/local/callback'
});
const fsconnector = new Unifile.connects.FsConnector({showHiddenFile: true});
const sftpconnector = new Unifile.connects.SftpConnector({redirectUri: 'http://localhost:6805/sftp/signin'});


const gdriveconnector = new Unifile.connects.GoogleDriveConnector({
	clientId: '142047696565-e85s5df5r25tojtk1q1v40eqolc4c9lt.apps.googleusercontent.com',
	clientSecret: '67Cr51-XRoC2lL_Q9FH5QCIN',
	redirectUri : "http://localhost:6805/volumes/gdrive/oauth-callback"
});

const volumes = new Unifile.connects.VolumesConnector({
});


// mount volumes
volumes.mount(ghconnector);
volumes.mount(dbxconnector);
volumes.mount(ftpconnector);
volumes.mount(rsconnector);
///ufs.use(wdconnector);
volumes.mount(fsconnector);
volumes.mount(lsconnector);
volumes.mount(sftpconnector);
volumes.mount(gdriveconnector);

const ufs = new Unifile.FileSystem(volumes);

// Search for a old session token in the cookies
volumesRouter.get('/', function(req, res) {
	// Init ufs session in Express
	req.session.ufs = req.session.ufs || {};

	let response;
	if(req.cookies.ufs_github)
		response = ufs.setAccessToken(req.session.ufs, req.cookies.ufs_github, 'github');
	if(req.cookies.ufs_dropbox)
		response = ufs.setAccessToken(req.session.ufs, req.cookies.ufs_dropbox, 'dropbox');

	if(response)
		response.then(() => res.sendFile(Path.join(__dirname, 'public/volumes', 'index.html')));
	else res.sendFile(Path.join(__dirname, 'public/volumes', 'index.html'));
});


require("../../lib/routes/volumes")(volumesRouter,ufs,{
	"authorizes" : {
		signin : function(req, res) {
	      res.sendFile(Path.join(__dirname, 'public/volumes', req.params.connector + '_login.html'));
	    }
	}
});


// server 'loop'
const port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
	console.log('Listening on ' + port);
});
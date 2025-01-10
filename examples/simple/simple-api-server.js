'use strict';

const Path = require('path');
const PassThrough = require('stream').PassThrough;
require('amd-loader');
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
	clientId: '0d02bf5aa3afb93c8dce',
	clientSecret: 'ad1950c97b22e2119298d19d24932ef500f45069',
	redirectUri : "http://localhost:6805/volumes/github/oauth-callback"
});
const dbxconnector = new Unifile.connects.DropboxConnector({
	clientId: '37mo489tld3rdi2',
	clientSecret: 'kqfzd11vamre6xr',
	redirectUri: 'http://localhost:6805/volumes/dropbox/oauth-callback'
});
const ftpconnector = new Unifile.connects.FtpConnector({redirectUri: 'http://localhost:6805/volumes/ftp/signin'});
///const wdconnector = new Unifile.WebDavConnector({redirectUri: 'http://localhost:6805/webdav/signin'});
const rsconnector = new Unifile.connects.HttpConnector({
	redirectUri: 'http://localhost:6805/volumes/http/callback'
});
const lsconnector = new Unifile.connects.LocalConnector({
	mappedRealFolder : "C:\\tmp",
	redirectUri: 'http://localhost:6805/volumes/local/callback'
});
const fsconnector = new Unifile.connects.FsConnector({showHiddenFile: true});
const sftpconnector = new Unifile.connects.SftpConnector({redirectUri: 'http://localhost:6805/volumes/sftp/signin'});


const gdriveconnector = new Unifile.connects.GoogleDriveConnector({
	clientId: '142047696565-e85s5df5r25tojtk1q1v40eqolc4c9lt.apps.googleusercontent.com',
	clientSecret: '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',
	redirectUri : "http://localhost:6805/volumes/gdrive/oauth-callback"
});

const volumes = new Unifile.connects.VolumesConnector({
});


// mount volumes
volumes.mount(ghconnector);
//volumes.mount(dbxconnector);
volumes.mount(ftpconnector);
volumes.mount(rsconnector);
///ufs.use(wdconnector);
volumes.mount(fsconnector);
volumes.mount(lsconnector);
volumes.mount(sftpconnector);
volumes.mount(gdriveconnector);

///const ufs = new Unifile.FileSystem(volumes);

// Search for a old session token in the cookies
volumesRouter.get('/', function(req, res) {
	// Init ufs session in Express
    res.sendFile(Path.join(__dirname, 'public/volumes', 'index.html'));
});


require("../../lib/routes/volumes")(volumesRouter,{
	ufs : function(req,res) {
		if (!req.ufs) {
			const ufsSession = req.session.ufs = req.session.ufs || {};
			req.ufs = new Unifile.FileSystem(volumes,ufsSession);
		}
		return req.ufs;
	},
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
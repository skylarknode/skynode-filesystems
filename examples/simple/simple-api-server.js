'use strict';

const Path = require('path');
const PassThrough = require('stream').PassThrough;

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const Unifile = require('../../lib/index');

const app = express();
const ufs = new Unifile();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
	secret: 'ufs',
	resave: false,
	saveUninitialized: false
}));

// Configure connectors
const ghconnector = new Unifile.GitHubConnector({
	clientId: 'b4e46028bf36d871f68d',
	clientSecret: 'c39806c4d0906cfeaac932012996a1919475cc78',
	redirectUri : "http://localhost:6805/github/oauth-callback"
});
const dbxconnector = new Unifile.DropboxConnector({
	clientId: '37mo489tld3rdi2',
	clientSecret: 'kqfzd11vamre6xr',
	redirectUri: 'http://localhost:6805/dropbox/oauth-callback'
});
const ftpconnector = new Unifile.FtpConnector({redirectUri: 'http://localhost:6805/ftp/signin'});
///const wdconnector = new Unifile.WebDavConnector({redirectUri: 'http://localhost:6805/webdav/signin'});
const rsconnector = new Unifile.HttpConnector({
	redirectUri: 'http://localhost:6805/http/callback'
});
const lsconnector = new Unifile.LocalConnector({
	mappedRealFolder : "C:\\tmp",
	redirectUri: 'http://localhost:6805/local/callback'
});
const fsconnector = new Unifile.FsConnector({showHiddenFile: true});
const sftpconnector = new Unifile.SftpConnector({redirectUri: 'http://localhost:6805/sftp/signin'});


const gdriveconnector = new Unifile.GoogleDriveConnector({
	clientId: '142047696565-e85s5df5r25tojtk1q1v40eqolc4c9lt.apps.googleusercontent.com',
	clientSecret: '67Cr51-XRoC2lL_Q9FH5QCIN',
	redirectUri : "http://localhost:6805/gdrive/oauth-callback"
});

// Register connectors
ufs.use(ghconnector);
ufs.use(dbxconnector);
ufs.use(ftpconnector);
ufs.use(rsconnector);
///ufs.use(wdconnector);
ufs.use(fsconnector);
ufs.use(lsconnector);
ufs.use(sftpconnector);
ufs.use(gdriveconnector);


// Search for a old session token in the cookies
app.get('/', function(req, res) {
	// Init ufs session in Express
	req.session.ufs = req.session.ufs || {};

	let response;
	if(req.cookies.ufs_github)
		response = ufs.setAccessToken(req.session.ufs, 'github', req.cookies.ufs_github);
	if(req.cookies.ufs_dropbox)
		response = ufs.setAccessToken(req.session.ufs, 'dropbox', req.cookies.ufs_dropbox);

	if(response)
		response.then(() => res.sendFile(Path.join(__dirname, 'public', 'index.html')));
	else res.sendFile(Path.join(__dirname, 'public', 'index.html'));
});


require("../../lib/routes/authorizes")(app,ufs,{
	signin : function(req, res) {
      res.sendFile(Path.join(__dirname, 'public', req.params.connector + '_login.html'));
    }
});

require("../../lib/routes/singulars")(app,ufs);

require("../../lib/routes/batch")(app,ufs);


// server 'loop'
const port = process.env.PORT || 6805; // 6805 is the date of sexual revolution started in paris france 8-)
app.listen(port, function() {
	console.log('Listening on ' + port);
});
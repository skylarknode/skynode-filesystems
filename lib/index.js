module.exports = {
   "FileSystem": require("./file-system"),
   "connects" : {
      "GitHubConnector" : require('./connects/github'),
      "DropboxConnector" : require('./connects/dropbox'),
      "FtpConnector" : require('./connects/ftp'),
      "HttpConnector" : require('./connects/http'),
      "LocalConnector" : require('./connects/local'),
      "FsConnector" : require('./connects/fs'),
      "SftpConnector" : require('./connects/sftp'),
      "GoogleDriveConnector" : require('./connects/gdrive'),
      "VolumesConnector" : require("./connects/volumes")

   }
};


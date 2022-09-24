const vfs = require("skynode-vfs");
module.exports = {
   "FileSystem": vfs.FileSystem,
   "connects" : {
      "GitHubConnector" : vfs.connects.GitHubConnector,
      "DropboxConnector" : vfs.connects.DropboxConnector,
      "FtpConnector" : vfs.connects.FtpConnector,
      "HttpConnector" : vfs.connects.HttpConnector,
      "LocalConnector" : vfs.connects.LocalConnector,
      "FsConnector" : vfs.connects.FsConnector,
      "SftpConnector" : vfs.connects.SftpConnector,
      "GoogleDriveConnector" : vfs.connects.GoogleDriveConnector,
      "VolumesConnector" : require("./connects/volumes")

   }
};


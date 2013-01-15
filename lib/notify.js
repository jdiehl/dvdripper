var apns = require("apn");

var devices = [
    "de7c994f00779a5020ddae7e3dba84781c468d0815493ff394ddbcf044c4b8fa",
    "32d145433cf71473b8e1212296a0080604dd397b52a9dd7a8c4bd0b190a06848"
];

// create the connection
var options = {
    cert: 'certificate/cert.pem',     /* Certificate file path */
    certData: null,                   /* String or Buffer containing certificate data, if supplied uses this instead of cert file path */
    key:  'certificate/key.pem',      /* Key file path */
    keyData: null,                    /* String or Buffer containing key data, as certData */
    passphrase: null,                 /* A passphrase for the Key file */
    ca: null,                         /* String or Buffer of CA data to use for the TLS connection */
    pfx: null,                        /* File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above */
    pfxData: null,                    /* PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk. */
    // gateway: 'gateway.push.apple.com',/* gateway address */
    gateway: 'gateway.sandbox.push.apple.com',/* sandbox gateway address */
    port: 2195,                       /* gateway port */
    rejectUnauthorized: true,         /* Value of rejectUnauthorized property to be passed through to tls.connect() */
    enhanced: true,                   /* enable enhanced format */
    errorCallback: undefined,         /* Callback when error occurs function(err,notification) */
    cacheLength: 100,                 /* Number of notifications to cache for error purposes */
    autoAdjustCache: true,            /* Whether the cache should grow in response to messages being lost after errors. */
    connectionTimeout: 0              /* The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. */
};

function _createConnection() {
    var connection = new apns.Connection(options);

    connection.on("error", function (error) {
        console.log("Error:", error);
    });
    connection.on("transmitted", function () {
        console.log("Transmitted.");
        connection.destroyConnection();
    });

    return connection;
}

function _createNote(sender, message, device) {
    var note = new apns.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = 3;
    note.sound = "ping.aiff";
    note.alert = message;
    note.payload = {'messageFrom': sender};
    note.device = new apns.Device(device);
    return note;
}

// send the note
function notify(sender, message) {
    var connection = _createConnection();
    devices.forEach(function (device) {
        var note = _createNote(sender, message, device);
        connection.sendNotification(note);
    });
}

exports.notify = notify;

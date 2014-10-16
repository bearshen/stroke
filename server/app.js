var app = require('express') ()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)

var globadata = new Array();
var d = new Date();
var ts = d.getTime();
var lastupdated = ts;

function addnewstroke(newstroke) {
	var d = new Date();
	var ts = d.getTime();
	var tmp = {'timestamp': ts, 'data': newstroke};
	globaldata.push(tmp);
	lastupdated = ts;
	return tmp;
};

function partialupdate(ts) {
    // could do a binary search here, instead, we traverse.
    var transferdata = new Array();
    for (var i = 0; i < globaldata.length; ++i) {
        if (globaldata[i]['timestamp'] > ts) {
            transferdata.push(globaldata[i]);
        }
    }
    return transferdata;
};

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
	socket.emit('fullflush', globaldata);	
	socket.on('strokeupdate', function (msg) {
		var newstroke = addnewstroke(msg);
		socket.broadcast.emit('newstroke', newstroke);
		socket.emit('strokeupdateconfirm', 'ts = ' + lastupdated);
	});
	socket.on('partialupdate', function (msg) {
		var transferdata = partialupdate(msg);
		socket.emit('partialupdateresponse', transferdata);
	});
});
  
server.listen(8080);


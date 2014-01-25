// module dependencies
var express = require('express.io')
//, routes = require('./routes')
  , path = require('path')
  , uuid = require('node-uuid')
  , _ = require('lodash');

// setup server object
var app = express().http().io();

// configuration
app.configure(function () {
  app.set('port', process.env.PORT || 3000);
  app.set('view engine', 'jade');
//session support if needed
//app.use(express.cookieParser('your secret here'));
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

var rooms = [];
var Room = function () {
  this.id = uuid.v4();
  this.playerIds = [];
};

// ----- real-time routes -----

// sends player their id and a list of rooms
app.io.route('playerConnect', function (req) {
  var data = {};
  data.playerId = req.socket.id;

  // add room info to message
  AddRoomsToData(data);

  // send message to user
  req.io.emit('connectionReply', data);
});

// sends player an update room list
app.io.route('getRooms', function (req) {
  var data = {};

  // add room info to message
  AddRoomsToData(data);

  // send message to user
  req.io.emit('updatedRoomList', data);
});

// packs the room list and statistics onto the data message
function AddRoomsToData(data) {
  // filter down to only rooms that can accept a new player
  var availableRooms = _.filter(rooms, function (room) {
    return room.playerIds.length < 4;
  });

  // if no rooms are available, create a new room
  if (availableRooms.length == 0) {
    var newRoom = new Room();
    rooms.push(newRoom);
    availableRooms.push(newRoom);
  }

  // convert available rooms to just room id and player count
  // and attach to data message
  data.rooms = _.map(availableRooms, function (room) {
    return {
      roomId: room.id,
      playerCount: room.playerIds.length
    };
  });

  // attach total number of rooms to data message
  data.totalRooms = rooms.length;

  // map-reduce to get total number of players in game
  // and attach to message
  var roomCounts = _.map(rooms, function(room) {
    return room.playerIds.length;
  });
  data.playersInRooms = _.reduce(roomCounts, function (sum, count) {
    return sum + count;
  });
}

// attempts to allow a player to join a game:
// if successful, the player id is added to the room and notified;
// if failed, the player is sent a refusal;
app.io.route('joinRoom', function (req) {
  // find the room being requested
  var room = _.find(rooms, {id: req.data.roomId});

  // verify that player can join room:
  // room must exist and have less than 4 players
  if (!room || room.playerIds.length >= 4) {
    // send refusal
    req.io.emit('connectionRefused');
    return;
  }

  // register player with room
  room.playerIds.push(req.socket.id);
  req.io.join(room.id);

  // send verification that room was joined to the player with room id
  req.io.emit('roomJoined', {roomId: room.id});

  // handle player disconnection:
  // requires socket id to be captured in closure scope for later use
  req.socket.on('disconnect', function () {
    // find the room being left
    var roomToLeave = _.find(rooms, function (room) {
      return _.any(room.playerIds, function (id) {
        // capture socket id in closure scope
        return id == req.socket.id;
      });
    });
    // handle the rest of the disconnection
    LeaveRoom(roomToLeave, req);
  });
});

// handle a user leaving a room not by disconnection
app.io.route('leaveRoom', function (req) {
  // find the room being left
  var roomToLeave = _.find(rooms, {id: req.data.roomId});

  // handle the rest of the disconnection
  LeaveRoom(roomToLeave, req);
});

// does the heavy lifting for leaving a room
function LeaveRoom(roomToLeave, req) {
  // check for null/undefined
  if (roomToLeave) {

    // remove the player from the room data
    roomToLeave.playerIds = _.filter(roomToLeave.playerIds, function (id) {
      return id != req.socket.id;
    });

    // if the room is now empty, remove it from the room list
    if (roomToLeave.playerIds.length == 0) {
      rooms = _.filter(rooms, function (room) {
        return room.id != roomToLeave.id;
      });
    }
    // otherwise, notify other players in the room of the disconnection
    else {
      var data = {};
      data.playerId = req.socket.id;
      req.io.room(roomToLeave.id).broadcast('playerDisconnected', data);
    }

    // remove the player from the socket.io room
    req.io.leave(roomToLeave.id);
  }
}

// handles rebroadcast of gameplay messages to other players in the room
app.io.route('clientSend', function (req) {
  req.io.room(req.data.roomId).broadcast('clientReceive', req.data);
});

// handles rebroadcast of gameplay messages to other players in the room
app.io.route('localPlayerDied', function (req) {
  req.io.room(req.data.roomId).broadcast('remotePlayerDied', req.data);
});

// ----- path routes -----

// root route: returns game page
app.get('/', function (req, res) {
  res.render('index', { title: 'Retro Roman Zombie Apocalypse' });
});
//app.get('/', routes.index);

// start the server
app.listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});
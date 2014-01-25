var KEYCODE_SPACE = 32;
var KEYCODE_UP = 38;
var KEYCODE_LEFT = 37;
var KEYCODE_RIGHT = 39;
var KEYCODE_DOWN = 40;
var KEYCODE_Z = 90;

var canvas;
var stage;
var background;
var backgroundRed;
var backgroundGreen;
var backgroundBlue;
var spritesImage;
var spriteSheet;
var characters;
var projectiles;
var deadCharacterIds;
var colors;
var socket;
var localPlayerId;
var lastTime;
var lastHeartbeatTime;
var lastAttackTime;
var lastDeadCharacterPurgeTime;
var enemyInterval;
var lastEnemyTime;
var keyPressedDown;
var keyPressedUp;
var keyPressedLeft;
var keyPressedRight;
var keyPressedSpace;
var keyPressedZ;
var viewModel;
var sendLocalPlayerMotion;

// initialize the whole game site
function init() {
  // attach the easelJS stage to the canvas
  canvas = document.getElementById("gameCanvas");
  stage = new createjs.Stage(canvas);

  // initialize arrays
  characters = [];
  projectiles = [];
  deadCharacterIds = [];

  // setup the viewmodel for knockout
  var viewModelMaker = function () {
    var model = {};

    // in game data
    model.points = ko.observable();
    model.health = ko.observable();
    model.gameStarted = ko.observable();
    model.currentRoomId = ko.observable();
    model.dead = ko.observable();

    // room stats
    model.totalRooms = ko.observable();
    model.playersInRooms = ko.observable();

    // room list
    model.rooms = ko.observableArray();

    // this initiates room join with server
    model.joinRoom = function (room) {
      var data = {};
      data.playerId = localPlayerId;
      data.roomId = room.roomId;
      socket.emit('joinRoom', data);
    };

    // requests updated room list from server
    model.getRoomUpdate = function () {
      socket.emit('getRooms');
    };

    // returns player to room list
    model.returnToRoomList = function () {
      socket.emit('leaveRoom', {roomId: viewModel.currentRoomId()});
      stage.removeAllChildren();
      stage.removeAllEventListeners();
      model.getRoomUpdate();
      model.gameStarted(false);
    };

    // adds points to current score
    model.awardPoints = function (points) {
      model.points(model.points() + points);
    };

    // resets game state for a new game
    model.newGameReset = function () {
      model.points(0);
      model.health(100);
      model.gameStarted(false);
      model.dead(false);
    };

    return model;
  };

  // instantiate viewmodel and register with knockout
  viewModel = viewModelMaker();
  ko.applyBindings(viewModel);

  // connect to server
  socket = io.connect();

  // register callbacks for server messages
  socket.on('connectionReply', loadRoomsAndMyId);
  socket.on('roomJoined', startGame);
  socket.on('updatedRoomList', updateRooms);
  socket.on('connectionRefused', viewModel.getRoomUpdate);
  socket.on('clientReceive', handleGameDataReceivedFromServer);
  socket.on('playerDisconnected', handlePlayerDisconnect);
  socket.on('remotePlayerDied', handlePlayerDied);
  socket.emit('playerConnect');

  // load background
  backgroundRed = new createjs.Bitmap("/images/redGummyBear.png");
  backgroundGreen = new createjs.Bitmap("/images/greenGummyBear.png");
  backgroundBlue = new createjs.Bitmap("/images/blueGummyBear.png");

  // load sprite sheet
  spritesImage = new Image();
  spritesImage.onload = handleImageLoad;
  spritesImage.src = "/images/sprites.png";

}

// sets player id and room data from server message
function loadRoomsAndMyId(data) {
  localPlayerId = data.playerId;
  updateRooms(data);
}

// updates room stats and list from data message
function updateRooms(data) {
  viewModel.totalRooms(data.totalRooms);
  viewModel.playersInRooms(data.playersInRooms);
  viewModel.rooms(data.rooms);
}

function handlePlayerDisconnect(data) {
  handlePlayerDied(data);
}

function handlePlayerDied(data) {
  //trigger player death
  _.find(characters, {id: data.playerId}).die();
}

// parses spritesheet image into animations on an easelJS spritesheet object
function handleImageLoad() {
  // data about the organization of the sprite sheet
  var spriteData = {
    images: ["images/blueGummyBear.png","images/greenGummyBear.png","images/redGummyBear.png",
      "images/blueGummieProjectile.png","images/greenGummieProjectile.png","images/redGummieProjectile.png"],
    frames: [
        [0,0,119,179,0,60,0],
        [0,0,119,179,1,60,0],
        [0,0,119,179,2,60,0],
        [0,0,38,33,3,19,0],
        [0,0,38,33,4,19,0],
        [0,0,38,33,5,19,0]
//      [0, 0, 80, 80, 0, 40, 0],
//      [80, 0, 80, 80, 0, 40, 0],
//      [160, 0, 80, 80, 0, 40, 0],
//      [240, 0, 80, 80, 0, 40, 0],
//      [320, 0, 80, 80, 0, 40, 0],
//      [0, 80, 80, 80, 0, 40, 0],
//      [80, 80, 80, 80, 0, 40, 0],
//      [160, 80, 80, 80, 0, 40, 0],
//      [240, 80, 80, 80, 0, 40, 0],
//      [320, 80, 80, 80, 0, 40, 0],
//      [0, 160, 80, 80, 0, 40, 0],
//      [80, 160, 80, 80, 0, 40, 0],
//      [160, 160, 80, 80, 0, 40, 0],
//      [240, 160, 80, 80, 0, 40, 0],
//      [320, 160, 80, 80, 0, 40, 0]
    ],
    animations: {
      bluestand: 0,
      bluewalk: 0,
      blueattack: 0,
      greenstand: 1,
      greenwalk: 1,
      greenattack: 1,
      redstand: 2,
      redwalk: 2,
      redattack: 2,
      blueprojectile: 3,
      greenprojectile: 4,
      redprojectile: 5

//      bluestand: 0,
//      bluewalk: { frames: [1, 0, 2, 0], frequency: 6 },
//      blueattack: { frames: [0, 3, 4, 3], frequency: 6 },
//      greenstand: 5,
//      greenwalk: { frames: [6, 5, 7, 5], frequency: 6 },
//      greenattack: { frames: [5, 8, 9, 8], frequency: 6 },
//      redstand: 10,
//      redwalk: { frames: [11, 10, 12, 10], frequency: 6 },
//      redattack: { frames: [10, 13, 14, 13], frequency: 6 }
    }
  };

  // initialize the spritesheet object
  spriteSheet = new createjs.SpriteSheet(spriteData);
}

// start a game
function startGame(data) {
  // set the room id based on server message
  viewModel.currentRoomId(data.roomId);

  // initialize time trackers
  lastTime = 0;
  lastHeartbeatTime = 0;
  lastAttackTime = 0;
  lastEnemyTime = 0;
  lastDeadCharacterPurgeTime = 0;
  enemyInterval = 1000;

  // set key press flags to false
  keyPressedDown = false;
  keyPressedUp = false;
  keyPressedLeft = false;
  keyPressedRight = false;
  keyPressedSpace = false;
  sendLocalPlayerMotion = false;

  // clear arrays
  characters.length = 0;
  deadCharacterIds.length = 0;
  projectiles.length = 0;

  background = backgroundRed;

  // strip stage and add background
  stage.removeAllChildren();
  stage.removeAllEventListeners();
  stage.addChild(background);

  // setup player colors
  colors = ['red','green','blue'];

  //todo figure out where to place new players on the stage...
  // instantiate local player
  addNewPlayer({
    id: localPlayerId,
    spritex: canvas.width / 2,
    spritey: canvas.height / 2,
    updown: 0,
    leftright: 0,
    facingLeftright: -1,
    color: 'red'
  });

  // reset viewmodel game state
  viewModel.newGameReset();
  // set flag that game has started
  viewModel.gameStarted(true);

  // attach key press functions to document events
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;

  // set preferred frame rate to 60 frames per second and
  // use requestanimationframe if available
  createjs.Ticker.useRAF = true;
  createjs.Ticker.setFPS(60);

  // start the game loop
  if (!createjs.Ticker.hasEventListener("tick")) {
    createjs.Ticker.addEventListener("tick", tick);
  }
}

// main game loop
function tick() {
  // get current time
  var now = Date.now();

  // get difference in time since last frame
  // this makes the game logic run independent of frame rate
  var deltaTime = now - lastTime;

  //todo add collision detection
  //part 1: did something hit me
  //part 2: did one of my bullets hit something and go away

  // move all of the characters
  for (var i = 0; i < characters.length; i++)
    if (characters[i])
      characters[i].move(deltaTime);

  // move all of the projectiles
  for (var i = 0; i < projectiles.length; i++)
    if (projectiles[i])
      projectiles[i].move(deltaTime);

  // sort depth layers by reinsertion based on y value
  var combinedArray = characters.concat(projectiles);
  var sortedSprites = _.sortBy(combinedArray, function (character) {
    return character.sprite.y;
  });
  // strip the stage
  stage.removeAllChildren();
  // reinsert the stage
  stage.addChild(background);
  // reinsert the characters in sorted order
  for (var i = 0; i < sortedSprites.length; i++)
    stage.addChild(sortedSprites[i].sprite);

  // determine if any local models attacked
  var localModelDidSomethingImportant = _.any(characters, function (character) {
    return (character.justSwitchedColor || character.justAttacked) && character.id == localPlayerId;
  });

  // send game data if motion occurred, any local character attacked,
  // or just a heartbeat every 500 milliseconds
  if (sendLocalPlayerMotion || localModelDidSomethingImportant || now - lastHeartbeatTime > 500) {
    sendLocalPlayerMotion = false;
    sendGameDataToServer();
    lastHeartbeatTime = now;
  }

  // fixes for characters that need to happen after sending game data
  for (var i = 0; i < characters.length; i++) {
    // reset justAttacked flags for all characters
    characters[i].justAttacked = false;

    // remove characters that are out of health or have not been updated
    if (characters[i].health <= 0 || now - characters[i].lastUpdateTime > 3000)
      characters[i].die();
  }

  // strip the dead from characters array;
  // sprite will not be reinserted to stage during sorting on next tick
  characters = _.where(characters, {dead: false});

  // purge dead characters after they have been dead more than 10 seconds
  if (now - lastDeadCharacterPurgeTime > 3001) {
    deadCharacterIds = _.filter(deadCharacterIds, function (id) {
      return now - id.time > 3001;
    });
    lastDeadCharacterPurgeTime = now;
  }

  // update stage graphics
  stage.update();
  lastTime = now;
}

// handle key down event - returns true for non game keys, false otherwise
function handleKeyDown(e) {
  // use common key handling code with custom switch callback
  return handleKeySignals(e, function (e, player) {
    var nonGameKeyPressed = true;
    switch (e.keyCode) {
      case KEYCODE_LEFT:
        if (!keyPressedLeft) {
          keyPressedLeft = true;
          player.startLeftMotion();
        }
        nonGameKeyPressed = false;
        break;
      case KEYCODE_RIGHT:
        if (!keyPressedRight) {
          keyPressedRight = true;
          player.startRightMotion();
        }
        nonGameKeyPressed = false;
        break;
      case KEYCODE_DOWN:
        if (!keyPressedDown) {
          keyPressedDown = true;
          player.startDownMotion();
        }
        nonGameKeyPressed = false;
        break;
      case  KEYCODE_UP:
        if (!keyPressedUp) {
          keyPressedUp = true;
          player.startUpMotion();
        }
        nonGameKeyPressed = false;
        break;
      case KEYCODE_SPACE:
        if (!keyPressedSpace) {
          player.justAttacked = true;
          keyPressedSpace = true;
          player.fireProjectile();
        }
        nonGameKeyPressed = false;
        break;
      case KEYCODE_Z:
        if (!keyPressedZ) {
          player.justSwitchedColor = true;
          keyPressedZ = true;
          player.switchToNextColor();
        }
        nonGameKeyPressed = false;
        break;
    }
    // return necessary to tell the browser whether it should handle the
    // key separately; don't want game keys being passed back to the
    // browser
    return nonGameKeyPressed;
  });
}

// handle key up event - returns true for non game keys, false otherwise
function handleKeyUp(e) {
  // use common key handling code with custom switch callback
  return handleKeySignals(e, function (e, player) {
    var nonGameKeyPressed = true;
    switch (e.keyCode) {
      case KEYCODE_LEFT:
        keyPressedLeft = false;
        player.stopLeftRightMotion();
        nonGameKeyPressed = false;
        break;
      case KEYCODE_RIGHT:
        keyPressedRight = false;
        player.stopLeftRightMotion();
        nonGameKeyPressed = false;
        break;
      case KEYCODE_DOWN:
        keyPressedDown = false;
        player.stopUpDownMotion();
        nonGameKeyPressed = false;
        break;
      case KEYCODE_UP:
        keyPressedUp = false;
        player.stopUpDownMotion();
        nonGameKeyPressed = false;
        break;
      case KEYCODE_SPACE:
        keyPressedSpace = false;
        nonGameKeyPressed = false;
        break;
      case KEYCODE_Z:
        keyPressedZ = false;
        nonGameKeyPressed = false;
        break;
    }
    // return necessary to tell the browser whether it should handle the
    // key separately; don't want game keys being passed back to the
    // browser
    return nonGameKeyPressed;
  });
}

// common code for key up/down events;
// takes a callback for handling unique elements of each
function handleKeySignals(e, switchHandler) {
  if (!e)
    e = window.event;
  var player = _.find(characters, {id: localPlayerId});
  var lastLeftright = player.leftright;
  var lastUpdown = player.updown;
  var nonGameKeyPressed = switchHandler(e, player);

  if (!nonGameKeyPressed && (lastLeftright != player.leftright || lastUpdown != player.updown || player.justAttacked))
    sendLocalPlayerMotion = true;
  return nonGameKeyPressed;
}

// sends current player's game state to server
function sendGameDataToServer() {
  // initialize data message
  var data = {};

  // attach room and player ids
  data.roomId = viewModel.currentRoomId();
  data.playerId = localPlayerId;

  // initialize character array
  data.chars = [];

  // find local player and pack player data on message
  var player = _.find(characters, {id: localPlayerId});
  if (player)
    player.appendDataToMessage(data);

  data.projectiles = [];

  var newProjectiles = _.filter(projectiles, {justCreated: true, ownerId: localPlayerId});
  for (var i = 0; i < newProjectiles.length; i++)
    newProjectiles[i].appendDataToMessage(data);

  //todo need to pack score data on messages

  // ship data to the server
  socket.emit('clientSend', data);
}

// callback for handling game data shipped from the server;
// parses through the data and calls appropriate functions
// to sync the local game model with the received data
function handleGameDataReceivedFromServer(data) {
  // find local model of remote player
  var playerFound = _.find(characters, {id: data.playerId});
  // extract remote player data from data message
  var playerData = _.find(data.chars, {id: data.playerId});
  // if player exists, update local representation model
  if (playerFound && playerData)
    playerFound.updateLocalCharacterModel(playerData);
  // when player does not exist and was not recently killed, add them
  else if (playerData && !_.any(deadCharacterIds, {id: data.playerId}))
    addNewPlayer(playerData);

  // extract models of remotely owned enemies from data message
  var projectileDataList = _.where(data.projectiles, {ownerId: data.playerId});
  // iterate over zombies being updated
  for (var i = 0; i < projectileDataList.length; i++) {
    // extract specific remote zombie data from data message
    var projectileData = _.find(data.projectiles, {id: projectileDataList[i].id});
    // when zombie does not exist and was not recently killed, add them
    if (projectileData && !_.any(deadCharacterIds, {id: projectileDataList[i].id}))
      addNewProjectile(projectileData);
  }

  //todo need to unpack score data
}

// create a new local model for a player based on options object
function addNewPlayer(options) {
  // add the new player to the characters array
  characters.push(generatePlayer({
    id: options.id,
    x: options.spritex,
    y: options.spritey,
    updown: options.updown,
    leftright: options.leftright,
    facingLeftright: options.facingLeftright,
    color: options.color,
    characterType: 'player',
    health: 100
  }));
}

// create a new local model for a projectile based on options object
function addNewProjectile(options) {
  // add the new player to the characters array
  projectiles.push(generateProjectile({
    id: options.id,
    ownerId: options.ownerId,
    x: options.spritex,
    y: options.spritey,
    updown: options.updown,
    leftright: options.leftright,
    color: options.color
  }));
}
//
//// randomly issue an unused player color for a new player
//function pickNewPlayerColor() {
//  // start at a random color
//  var colorIndex = Math.floor(Math.random() * 4);
//  var result = false;
//  // iterate over the colors array looking for the first unused color
//  for (var i = 0; i < colors.length; i++) {
//    if (colors[colorIndex].unused) {
//      result = colors[colorIndex].color;
//      colors[colorIndex].unused = false;
//      break;
//    }
//    colorIndex = (colorIndex + 1) % colors.length;
//  }
//  // return the first unused color found
//  return result;
//}

//    id: uuid.v4(),


var KEYCODE_SPACE = 32;
var KEYCODE_UP = 38;
var KEYCODE_LEFT = 37;
var KEYCODE_RIGHT = 39;
var KEYCODE_DOWN = 40;

var canvas;
var stage;
var background;
var spritesImage;
var spriteSheet;
var characters;
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
var viewModel;
var sendLocalPlayerMotion;

// initialize the whole game site
function init() {
  // attach the easelJS stage to the canvas
  canvas = document.getElementById("gameCanvas");
  stage = new createjs.Stage(canvas);

  // initialize arrays
  characters = [];
  deadCharacterIds = [];

  // setup the viewmodel for knockout
  var viewModelMaker = function () {
    var self = this;

    // in game data
    self.points = ko.observable();
    self.health = ko.observable();
    self.gameStarted = ko.observable();
    self.currentRoomId = ko.observable();
    self.dead = ko.observable();

    // room stats
    self.totalRooms = ko.observable();
    self.playersInRooms = ko.observable();

    // room list
    self.rooms = ko.observableArray();

    // this initiates room join with server
    self.joinRoom = function (room) {
      var data = {};
      data.playerId = localPlayerId;
      data.roomId = room.roomId;
      socket.emit('joinRoom', data);
    };

    // requests updated room list from server
    self.getRoomUpdate = function () {
      socket.emit('getRooms');
    };

    // returns player to room list
    self.returnToRoomList = function () {
      socket.emit('leaveRoom', {roomId: viewModel.currentRoomId()});
      stage.removeAllChildren();
      stage.removeAllEventListeners();
      self.getRoomUpdate();
      self.gameStarted(false);
    };

    // adds points to current score
    self.awardPoints = function (points) {
      self.points(self.points() + points);
    };

    // resets game state for a new game
    self.newGameReset = function () {
      self.points(0);
      self.health(100);
      self.gameStarted(false);
      self.dead(false);
    };
  };

  // instantiate viewmodel and register with knockout
  viewModel = new viewModelMaker();
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
  background = new createjs.Bitmap("/images/colosseum.png");

  // load sprite sheet
  spritesImage = new Image();
  spritesImage.onload = handleImageLoad;
  spritesImage.src = "/images/sprites.png";

  //todo load the background image!!!
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

  // clean up abandoned zombies
  _.map(characters, function (character) {
    if (character.characterType == 'zombie' && character.ownerId == data.playerId)
      character.die();
  });
}

function handlePlayerDied(data) {
  //trigger player death
  _.find(characters, {id: data.playerId}).die();
}

// parses spritesheet image into animations on an easelJS spritesheet object
function handleImageLoad() {
  // data about the organization of the sprite sheet
  var spriteData = {
    images: ["images/sprites.png"],
    frames: [
      [0, 0, 80, 80, 0, 40, 0],
      [80, 0, 80, 80, 0, 40, 0],
      [160, 0, 80, 80, 0, 40, 0],
      [240, 0, 80, 80, 0, 40, 0],
      [320, 0, 80, 80, 0, 40, 0],
      [0, 80, 80, 80, 0, 40, 0],
      [80, 80, 80, 80, 0, 40, 0],
      [160, 80, 80, 80, 0, 40, 0],
      [240, 80, 80, 80, 0, 40, 0],
      [320, 80, 80, 80, 0, 40, 0],
      [0, 160, 80, 80, 0, 40, 0],
      [80, 160, 80, 80, 0, 40, 0],
      [160, 160, 80, 80, 0, 40, 0],
      [240, 160, 80, 80, 0, 40, 0],
      [320, 160, 80, 80, 0, 40, 0],
      [0, 240, 80, 80, 0, 40, 0],
      [80, 240, 80, 80, 0, 40, 0],
      [160, 240, 80, 80, 0, 40, 0],
      [240, 240, 80, 80, 0, 40, 0],
      [320, 240, 80, 80, 0, 40, 0],
      [0, 320, 80, 80, 0, 40, 0],
      [80, 320, 80, 80, 0, 40, 0],
      [160, 320, 80, 80, 0, 40, 0],
      [240, 320, 80, 80, 0, 40, 0],
      [320, 320, 80, 80, 0, 40, 0]
    ],
    animations: {
      bluestand: 0,
      bluewalk: { frames: [1, 0, 2, 0], frequency: 6 },
      blueattack: { frames: [0, 3, 4, 3], frequency: 6 },
      greenstand: 5,
      greenwalk: { frames: [6, 5, 7, 5], frequency: 6 },
      greenattack: { frames: [5, 8, 9, 8], frequency: 6 },
      redstand: 10,
      redwalk: { frames: [11, 10, 12, 10], frequency: 6 },
      redattack: { frames: [10, 13, 14, 13], frequency: 6 },
      yellowstand: 15,
      yellowwalk: { frames: [16, 15, 17, 15], frequency: 6 },
      yellowattack: { frames: [15, 18, 19, 18], frequency: 6 },
      zombiestand: 20,
      zombiewalk: { frames: [21, 20, 22, 20], frequency: 10 },
      zombieattack: { frames: [20, 23, 24, 23], frequency: 10 }
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

  // strip stage and add background
  stage.removeAllChildren();
  stage.removeAllEventListeners();
  stage.addChild(background);

  // setup player colors
  colors = [];
  colors.push({color: 'red', unused: true});
  colors.push({color: 'green', unused: true});
  colors.push({color: 'blue', unused: true});
  colors.push({color: 'yellow', unused: true});

  // add vertically and horizontally flipped animations to spritesheet
  createjs.SpriteSheetUtils.addFlippedFrames(spriteSheet, true, true, false);

  // instantiate local player
  addNewPlayer({
    id: localPlayerId,
    spritex: canvas.width / 2,
    spritey: canvas.height / 2,
    updown: 0,
    leftright: 0,
    facingLeftright: -1
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

  // generate enemies
  if (now - lastEnemyTime > enemyInterval) {
    generateZombie();
    enemyInterval = Math.floor(Math.random() * 2000) + 2000;
    lastEnemyTime = now;
  }

  // establish targeting and attacks by enemies
  var zombies = _.where(characters, {ownerId: localPlayerId});
  for (var i = 0; i < zombies.length; i++) {
    if (now - zombies[i].lastPlayerLockTime > 51) {
      zombies[i].lockOnPlayer();
      zombies[i].lastPlayerLockTime = now;
    }
    if (zombies[i].canAttemptAttack &&
      now - zombies[i].lastAttackAttemptTime > Math.floor(Math.random() * 500) + 500) {
      zombies[i].setToAttack();
      zombies[i].lastAttackAttemptTime = now;
    }
    zombies[i].determineDirectionsAndActions();
  }

  // move all of the characters
  for (var i = 0; i < characters.length; i++)
    if (characters[i])
      characters[i].move(deltaTime);

  // sort depth layers by reinsertion based on y value
  var sortedCharacters = _.sortBy(characters, function (character) {
    return character.sprite.y;
  });
  // strip the stage
  stage.removeAllChildren();
  // reinsert the stage
  stage.addChild(background);
  // reinsert the characters in sorted order
  for (var i = 0; i < sortedCharacters.length; i++)
    stage.addChild(sortedCharacters[i].sprite);

  // determine if any local models attacked
  var localModelAttacked = _.any(characters, function (character) {
    if (!character.justAttacked)
      return false;
    if (character.characterType == 'player' && character.id == localPlayerId)
      return true;
    if (character.characterType == 'zombie' && character.ownerId == localPlayerId)
      return true;
    return false;
  });

  // send game data if motion occurred, any local character attacked,
  // or just a heartbeat every 500 milliseconds
  if (sendLocalPlayerMotion || localModelAttacked || now - lastHeartbeatTime > 500) {
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
          player.handleAttackOn('zombie');
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

  // find zombies owned by local player and pack their data on message
  var zombies = _.where(characters, {ownerId: localPlayerId});
  for (var i = 0; i < zombies.length; i++)
    zombies[i].appendDataToMessage(data);

  // initialize damaged enemy array
  data.damaged = [];

  // find zombies that local player has damaged and pack their
  // data on message for updating their owner
  var zombies = _.where(characters, {damaged: true});
  for (var i = 0; i < zombies.length; i++)
    zombies[i].appendDamagedDataToMessage(data);

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
  var zombieDataList = _.where(data.chars, {ownerId: data.playerId});
  // iterate over zombies being updated
  for (var i = 0; i < zombieDataList.length; i++) {
    // find local model of remote zombie
    var zombieFound = _.find(characters, {id: zombieDataList[i].id});
    // extract specific remote zombie data from data message
    var zombieData = _.find(data.chars, {id: zombieDataList[i].id});
    // if zombie exists, update local representation model
    if (zombieFound && zombieData)
      zombieFound.updateLocalCharacterModel(zombieData);
    // when zombie does not exist and was not recently killed, add them
    else if (zombieData && !_.any(deadCharacterIds, {id: zombieDataList[i].id}))
      addNewZombie(zombieData);
  }

  // remove zombies that are no longer being updated
  var localZombiesModelsForIncomingData = _.where(data.chars, {ownerId: data.playerId});
  for (var i = 0; i < localZombiesModelsForIncomingData.length; i++) {
    if (!_.any(zombieDataList, {id: localZombiesModelsForIncomingData[i].id}))
      localZombiesModelsForIncomingData[i].die();
  }


  // find local models of damaged zombies that local player owns
  var damagedZombieDataList = _.where(data.damaged, {ownerId: localPlayerId});
  // iterate over damaged zombies being updated
  for (var i = 0; i < damagedZombieDataList.length; i++) {
    // find local model of local zombie
    var zombieFound = _.find(characters, {id: damagedZombieDataList[i].id});
    // extract damage model for zombie
    var zombieData = _.find(data.damaged, {id: damagedZombieDataList[i].id});
    // if matches are found, issue damage to the local model
    if (zombieFound && zombieData)
      zombieFound.takeDamage(zombieData.damage);
  }
}

// create a new local model for a player based on options object
function addNewPlayer(options) {
  // add the new player to the characters array
  characters.push(new Player({
    id: options.id,
    x: options.spritex,
    y: options.spritey,
    updown: options.updown,
    leftright: options.leftright,
    facingLeftright: options.facingLeftright,
    color: pickNewPlayerColor(),
    characterType: 'player',
    health: 100
  }));
}

// randomly issue an unused player color for a new player
function pickNewPlayerColor() {
  // start at a random color
  var colorIndex = Math.floor(Math.random() * 4);
  var result = false;
  // iterate over the colors array looking for the first unused color
  for (var i = 0; i < colors.length; i++) {
    if (colors[colorIndex].unused) {
      result = colors[colorIndex].color;
      colors[colorIndex].unused = false;
      break;
    }
    colorIndex = (colorIndex + 1) % colors.length;
  }
  // return the first unused color found
  return result;
}

// create a new local model for a zombie based on options object
function addNewZombie(options) {
  // add the new zombie to the characters array
  characters.push(new Zombie({
    id: options.id,
    x: options.spritex,
    y: options.spritey,
    updown: options.updown,
    leftright: options.leftright,
    facingLeftright: options.facingLeftright,
    ownerId: options.ownerId,
    color: 'zombie',
    characterType: 'zombie',
    targetId: options.targetId,
    health: 100
  }));
}

// sets the coordinates of a new zombie and calls to add it locally
function generateZombie() {
  // pick left or right side of stage to spawn
  var x;
  if (Math.floor(Math.random() * 2) == 1)
    x = -50;
  else
    x = 550;

  // add the new zombie
  addNewZombie({
    id: uuid.v4(),
    spritex: x,
    spritey: Math.floor(Math.random() * 220) + 200,
    updown: 0,
    leftright: 0,
    facingLeftright: 1,
    ownerId: localPlayerId,
    targetId: localPlayerId
  });
}
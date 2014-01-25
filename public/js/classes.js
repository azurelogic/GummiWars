// Character constructor
var Player = function (options) {
  // setup Character common properties from options object as needed
  var player = {};
  player.id = options.id;
  player.sprite = new createjs.BitmapAnimation(spriteSheet);
  player.sprite.x = options.x;
  player.sprite.y = options.y;
  player.updown = options.updown;
  player.leftright = options.leftright;
  player.facingLeftright = player.leftright;
  player.color = options.color;
  player.characterType = options.characterType;
  player.justAttacked = false;
  player.velocityFactor = .08;
  player.damageRadius = 60;
  player.damageRadiusSquared = this.damageRadius * this.damageRadius;
  player.damageRating = 50;
  player.health = options.health;
  player.killedBy = null;
  player.stageBoundTrap = false;
  player.localAttackAnimationComplete = false;
  player.lastUpdateTime = Date.now();
  player.dead = false;

  // add sprite to the stage
  stage.addChild(player.sprite);
  stage.update();

  // setup animations on sprite sheet
  spriteSheet.getAnimation(player.color + 'stand').next = player.color + 'stand';
  spriteSheet.getAnimation(player.color + 'walk').next = player.color + 'walk';


  // setup player attack animation follow up
  spriteSheet.getAnimation(player.color + 'attack').next = player.color + 'stand';

  // start animation standing
  player.sprite.gotoAndPlay(player.getAnimationNameFor('stand'));
};

// updates character animation based on current direction components
Player.prototype.updateAnimation = function () {
  if ((this.updown != 0 || this.leftright != 0))
    this.sprite.gotoAndPlay(this.getAnimationNameFor('walk'));
  else
    this.sprite.gotoAndPlay(this.getAnimationNameFor('stand'));
};

// handles character movement based on current direction vector
Player.prototype.move = function (deltaTime) {
  // vertical/horizontal motiion
  if (this.updown == 0 || this.leftright == 0) {
    this.sprite.x += this.leftright * deltaTime * this.velocityFactor;
    this.sprite.y += this.updown * deltaTime * this.velocityFactor;
  }
  // diagonal motion
  else {
    this.sprite.x += this.leftright * deltaTime * this.velocityFactor * 0.70711;
    this.sprite.y += this.updown * deltaTime * this.velocityFactor * 0.70711;
  }

  //todo: fix to match new map bounds

  // set trap variable once a character enters the game area
  if (!this.stageBoundTrap && (this.sprite.x < 470 && this.sprite.x > 30))
    this.stageBoundTrap = true;

  // ensure character doesn't leave the game area if trap variable is set
  if (this.stageBoundTrap) {
    if (this.sprite.x < 30)
      this.sprite.x = 30;
    else if (this.sprite.x > 470)
      this.sprite.x = 470;
  }
  if (this.sprite.y < 200)
    this.sprite.y = 200;
  else if (this.sprite.y > 420)
    this.sprite.y = 420;

  // kill weird x-bound escapees
  if (this.sprite.x > 560 || this.sprite.x < -60)
    this.dead = true;

  // fix remote character animations
  if (this.localAttackAnimationComplete) {
    this.updateAnimation();
    this.localAttackAnimationComplete = false;
  }
};

// assemble the animation name based on character color, animation
// type, and current direction
Player.prototype.getAnimationNameFor = function (animationType) {
    return this.color + animationType;
};

// ----- motion handling function section -----
// these functions set the direction of motion, direction the
// character faces, and the current animation based on which
// key is being pressed or released
Player.prototype.startLeftMotion = function () {
  this.leftright = -1;
  this.facingLeftright = this.leftright;
  this.sprite.gotoAndPlay(this.getAnimationNameFor('walk'));
};

Player.prototype.startRightMotion = function () {
  this.leftright = 1;
  this.facingLeftright = this.leftright;
  this.sprite.gotoAndPlay(this.getAnimationNameFor('walk'));
};

Player.prototype.startUpMotion = function () {
  this.updown = -1;
  this.sprite.gotoAndPlay(this.getAnimationNameFor('walk'));
};

Player.prototype.startDownMotion = function () {
  this.updown = 1;
  this.sprite.gotoAndPlay(this.getAnimationNameFor('walk'));
};

Player.prototype.stopLeftRightMotion = function () {
  if (this.leftright != 0)
    this.facingLeftright = this.leftright;

  this.leftright = 0;
  this.updateAnimation();
};

Player.prototype.stopUpDownMotion = function () {
  this.updown = 0;
  this.updateAnimation();
};

// handles collision detection and damage delivery to opposing character type
Player.prototype.handleAttackOn = function (enemyType) {
  // start the attack animation
  this.startAttackMotion();

  // find the local models of the enemy type
  var opposingForces = _.where(characters, {characterType: enemyType});

  // perform collision detection with all opposing forces
  for (var i = 0; i < opposingForces.length; i++) {
    // don't bother with detailed collisions if out of damage radius range
    if (opposingForces[i].sprite.x > this.sprite.x + this.damageRadius ||
      opposingForces[i].sprite.x < this.sprite.x - this.damageRadius ||
      opposingForces[i].sprite.y > this.sprite.y + this.damageRadius ||
      opposingForces[i].sprite.y < this.sprite.y - this.damageRadius)
      continue;

    // calculate x and y distances
    var x = this.sprite.x - opposingForces[i].sprite.x;
    var y = this.sprite.y - opposingForces[i].sprite.y;

    // deliver damage if within damage radius and in the correct direction;
    // this is essentially a semicircle damage area in front of the character
    // with a little wrap around the back
    if (x * x + y * y <= this.damageRadiusSquared &&
      (opposingForces[i].sprite.x - this.sprite.x) * this.facingLeftright >= -10)
      opposingForces[i].takeDamage(this.damageRating, this);
  }
};

// stop character from moving and start playing attack animation
Player.prototype.startAttackMotion = function () {
  this.updown = 0;
  this.leftright = 0;
  this.sprite.gotoAndPlay(this.getAnimationNameFor('attack'));
};

// handle taking damage, marking characters as dead, and
// updating viewmodel for local player's health
Player.prototype.takeDamage = function (damageAmount, attacker) {
  // decrement character health
  this.health -= damageAmount;

  // mark 0 health characters as dead
  if (this.health <= 0) {
    this.dead = true;

    // mark who killed it -> used for points calculations
    if (attacker)
      this.killedBy = attacker.id;
  }

  // mark zombies as damaged
  if (this.characterType == 'zombie') {
    this.damaged = true;
    this.damageTaken += damageAmount;
  }

  // update health on viewmodel for knockout if local player was damaged
  if (this.id == localPlayerId)
    viewModel.health(this.health);
};

// appends player data to message
Player.prototype.appendDataToMessage = function (data) {
  data.chars.push({
    id: this.id,
    leftright: this.leftright,
    facingLeftright: this.facingLeftright,
    updown: this.updown,
    spritex: this.sprite.x,
    spritey: this.sprite.y,
    justAttacked: this.justAttacked
  });

  // set update time on local models
  this.lastUpdateTime = Date.now();
};

// updates local character model based on data in characterData
Player.prototype.updateLocalCharacterModel = function (characterData) {
  // update position/direction and health data
  this.sprite.x = characterData.spritex;
  this.sprite.y = characterData.spritey;
  this.updown = 0.8 * characterData.updown;
  this.leftright = 0.8 * characterData.leftright;
  this.facingLeftright = characterData.facingLeftright;

  // mark as updated
  this.lastUpdateTime = Date.now();

  // handle motion and attacks
  if (characterData.justAttacked) {
    // ensure that attack animation from remote characters complete
    this.sprite.onAnimationEnd = function () {
      this.localAttackAnimationComplete = true;
    };
    this.handleAttackOn('zombie');
  }
  else
    this.updateAnimation();
};

// handle player death
Player.prototype.die = function () {
  // add to dead list and mark as dead
  deadCharacterIds.push({id: this.id, time: Date.now()});
  this.dead = true;

  // update viewmodel and notify other players if local player died
  if (this.id == localPlayerId) {
    viewModel.dead(true);
    document.onkeydown = null;
    document.onkeyup = null;
    socket.emit('localPlayerDied', {playerId: localPlayerId, roomId: viewModel.currentRoomId()});
  }

  // release the color being used by the player
  _.find(colors, {color: this.color}).unused = true;
};

//// appends zombie damage data to message
//Zombie.prototype.appendDamagedDataToMessage = function (data) {
//  data.damaged.push({
//    id: this.id,
//    ownerId: this.ownerId,
//    damage: this.damageTaken
//  });
//
//  this.damaged = false;
//};
//
//// handle zombie death and award points
//Zombie.prototype.die = function () {
//  // award points on viewmodel if killed by local player
//  if (this.killedBy == localPlayerId)
//    viewModel.awardPoints(50);
//
//  deadCharacterIds.push({id: this.id, time: Date.now()});
//  this.dead = true;
//};
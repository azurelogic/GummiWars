// Character constructor
var character = function (options) {
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
  player.damageRadiusSquared = player.damageRadius * player.damageRadius;
  player.damageRating = 50;
  player.health = options.health;
  player.killedBy = null;
  player.stageBoundTrap = false;
  player.localAttackAnimationComplete = false;
  player.lastUpdateTime = Date.now();
  player.dead = false;

// updates character animation based on current direction components
  player.updateAnimation = function () {
    if ((player.updown != 0 || player.leftright != 0))
      player.sprite.gotoAndPlay(player.getAnimationNameFor('walk'));
    else
      player.sprite.gotoAndPlay(player.getAnimationNameFor('stand'));
  };

  // handles character movement based on current direction vector
  player.move = function (deltaTime) {
    // vertical/horizontal motiion
    if (player.updown == 0 || player.leftright == 0) {
      player.sprite.x += player.leftright * deltaTime * player.velocityFactor;
      player.sprite.y += player.updown * deltaTime * player.velocityFactor;
    }
    // diagonal motion
    else {
      player.sprite.x += player.leftright * deltaTime * player.velocityFactor * 0.70711;
      player.sprite.y += player.updown * deltaTime * player.velocityFactor * 0.70711;
    }

    //todo: fix to match new map bounds

    // set trap variable once a character enters the game area
    if (!player.stageBoundTrap && (player.sprite.x < 470 && player.sprite.x > 30))
      player.stageBoundTrap = true;

    // ensure character doesn't leave the game area if trap variable is set
    if (player.stageBoundTrap) {
      if (player.sprite.x < 30)
        player.sprite.x = 30;
      else if (player.sprite.x > 470)
        player.sprite.x = 470;
    }
    if (player.sprite.y < 200)
      player.sprite.y = 200;
    else if (player.sprite.y > 420)
      player.sprite.y = 420;

    // kill weird x-bound escapees
    if (player.sprite.x > 560 || player.sprite.x < -60)
      player.dead = true;

    // fix remote character animations
    if (player.localAttackAnimationComplete) {
      player.updateAnimation();
      player.localAttackAnimationComplete = false;
    }
  };

  // assemble the animation name based on character color, animation
  // type, and current direction
  player.getAnimationNameFor = function (animationType) {
    return player.color + animationType;
  };

 // ----- motion handling function section -----
 // these functions set the direction of motion, direction the
 // character faces, and the current animation based on which
 // key is being pressed or released
  player.startLeftMotion = function () {
    player.leftright = -1;
    player.facingLeftright = player.leftright;
    player.sprite.gotoAndPlay(player.getAnimationNameFor('walk'));
  };

  player.startRightMotion = function () {
    player.leftright = 1;
    player.facingLeftright = player.leftright;
    player.sprite.gotoAndPlay(player.getAnimationNameFor('walk'));
  };

  player.startUpMotion = function () {
    player.updown = -1;
    player.sprite.gotoAndPlay(player.getAnimationNameFor('walk'));
  };

  player.startDownMotion = function () {
    player.updown = 1;
    player.sprite.gotoAndPlay(player.getAnimationNameFor('walk'));
  };

  player.stopLeftRightMotion = function () {
    if (player.leftright != 0)
      player.facingLeftright = player.leftright;

    player.leftright = 0;
    player.updateAnimation();
  };

  player.stopUpDownMotion = function () {
    player.updown = 0;
    player.updateAnimation();
  };

  // handles collision detection and damage delivery to opposing character type
  player.handleAttackOn = function () {
    // start the attack animation
    player.startAttackMotion();

    //todo change this to find other characters' projectiles
    // find the local models of the enemy type
    var opposingForces = []; //_.where(characters, {characterType: enemyType});

    //this nee
    // perform collision detection with all opposing forces
    for (var i = 0; i < opposingForces.length; i++) {
      // don't bother with detailed collisions if out of damage radius range
      if (opposingForces[i].sprite.x > player.sprite.x + player.damageRadius ||
          opposingForces[i].sprite.x < player.sprite.x - player.damageRadius ||
          opposingForces[i].sprite.y > player.sprite.y + player.damageRadius ||
          opposingForces[i].sprite.y < player.sprite.y - player.damageRadius)
        continue;

      // calculate x and y distances
      var x = player.sprite.x - opposingForces[i].sprite.x;
      var y = player.sprite.y - opposingForces[i].sprite.y;

      // deliver damage if within damage radius and in the correct direction;
      // this is essentially a semicircle damage area in front of the character
      // with a little wrap around the back
      if (x * x + y * y <= player.damageRadiusSquared &&
          (opposingForces[i].sprite.x - player.sprite.x) * player.facingLeftright >= -10)
        opposingForces[i].takeDamage(player.damageRating, this);
    }
  };

  // stop character from moving and start playing attack animation
  player.startAttackMotion = function () {
    //player.updown = 0;
    //player.leftright = 0;
    player.sprite.gotoAndPlay(player.getAnimationNameFor('attack'));
  };

  // handle taking damage, marking characters as dead, and
  // updating viewmodel for local player's health
  player.takeDamage = function (damageAmount, attacker) {
    // decrement character health
    player.health -= damageAmount;

    // mark 0 health characters as dead
    if (player.health <= 0) {
      player.dead = true;

      // mark who killed it -> used for points calculations
      if (attacker)
        player.killedBy = attacker.id;
    }

    // mark zombies as damaged
    if (player.characterType == 'zombie') {
      player.damaged = true;
      player.damageTaken += damageAmount;
    }

    // update health on viewmodel for knockout if local player was damaged
    if (player.id == localPlayerId)
      viewModel.health(player.health);
  };

  player.switchToNextColor = function () {
    var indexOfCurrentColor = _.findIndex(colors, function (color) {
      return player.color == color;
    });

    player.color = colors[(indexOfCurrentColor + 1) % colors.length];

    //switch player sprite
    player.updateAnimation();

    //todo switch background
    //todo switch wall display
  };

  // appends player data to message
  player.appendDataToMessage = function (data) {
    data.chars.push({
      id: player.id,
      leftright: player.leftright,
      facingLeftright: player.facingLeftright,
      updown: player.updown,
      spritex: player.sprite.x,
      spritey: player.sprite.y,
      justAttacked: player.justAttacked
    });

    // set update time on local models
    player.lastUpdateTime = Date.now();
  };

  // updates local character model based on data in characterData
  player.updateLocalCharacterModel = function (characterData) {
    // update position/direction and health data
    player.sprite.x = characterData.spritex;
    player.sprite.y = characterData.spritey;
    player.updown = 0.8 * characterData.updown;
    player.leftright = 0.8 * characterData.leftright;
    player.facingLeftright = characterData.facingLeftright;

    // mark as updated
    player.lastUpdateTime = Date.now();

    // handle motion and attacks
    if (characterData.justAttacked) {
      // ensure that attack animation from remote characters complete
      player.sprite.onAnimationEnd = function () {
        player.localAttackAnimationComplete = true;
      };
      player.handleAttackOn('zombie');
    }
    else
      player.updateAnimation();
  };

  // handle player death
  player.die = function () {
    // add to dead list and mark as dead
    deadCharacterIds.push({id: player.id, time: Date.now()});
    player.dead = true;

    // update viewmodel and notify other players if local player died
    if (player.id == localPlayerId) {
      viewModel.dead(true);
      document.onkeydown = null;
      document.onkeyup = null;
      socket.emit('localPlayerDied', {playerId: localPlayerId, roomId: viewModel.currentRoomId()});
    }

    // release the color being used by the player
    _.find(colors, {color: player.color}).unused = true;
  };


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


  return player;
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
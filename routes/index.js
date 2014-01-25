
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Retro Colosseum Zombie Apocalypse' });
};
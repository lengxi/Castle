Profession = function() {
	this._id = -1;
	this.name = "";
	this.desc = "";
	this.canUse = null;
	this.onUse = null;
	this.hooks = [];
	this.init = function (_init) {
		this._id = _init._id;
		this.name = _init.name;
		this.desc = _init.desc;
		this.canUse = _init.canUse;
		this.onUse = _init.onUse;
		return this;
	};
	this.addHandler = function(handler) {
		this.hooks.push(handler);
	};
	this.removeHandler = function(predicate) {
		this.hooks = _.reject(hooks, predicate);
	}
};

Professions = {};

Professions.MOCK = new Profession().init({
  _id: 0,
  name: "Mock Profession",
  desc: "Change your association when you use this. Only if you have 3 or more cards in hand.",
  canUse: function(gameId, userId, target) {
    var game = Games.findOne({_id: gameId});
    var player = getPlayer(game.players, userId);
    return player.cards.length >= 4;
  },
  onUse: function(gameId, userId, target) {
    if (this.canUse(gameId, userId, target)) {
      var game = Games.findOne({_id: gameId});
      var player = getPlayer(game.players, userId);
      if (player.assoc === 0) 
        player.assoc = 1;
      else
        player.assoc = 0;
      Games.update({_id: gameId, "players._id": userId}, 
        {$set: {"players.$.assoc": player.assoc}});
      return true;
    } else {
      return false;
    }
  }
});

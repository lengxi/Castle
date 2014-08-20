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
  canUse: function(game_id, user_id, target) {
    var game = Games.findOne({_id: game_id});
    var user = getPlayer(game.players, user_id);
    return user.cards.length >= 43;
  },
  onUse: function(game_id, user_id, target) {
    if (this.canUse(game_id, user_id, target)) {
      var user = Meteor.users.findOne({_id: user_id});
      var assoc;
      if (user.assoc === 0) 
        assoc = 1;
      else
        assoc = 0;
      Games.update({_id: game_id, "players._id": user_id}, 
        {$set: {"players.$.assoc": assoc}});
      return true;
    } else {
      return false;
    }
  }
});

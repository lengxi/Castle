Card = function() {
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

Cards = {};

Cards.MOCK = new Card().init({
  _id: 0,
  name: "Mock card",
  desc: "Does nothing",
  canUse: function(game_id, user, target) {
    return true;
  },
  onUse: function(game_id, user, target) {
    return true;
  }
});

Cards.GOBLET = new Card().init({
  _id: 1,
  name: "Goblet",
  desc: "Society of Open Secrets Victory item",
  canUse: function(game_id, user, target) {
    return true;
  },
  onUse: function(game_id, user, target) {
    return true;
  }
});

Cards.KEY = new Card().init({
  _id: 2,
  name: "Key",
  desc: "Order of True Lies Victory item",
  canUse: function(game_id, user, target) {
    return true;
  },
  onUse: function(game_id, user, target) {
    return true;
  }
});

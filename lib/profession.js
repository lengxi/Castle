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

Professions.ALCHEMIST = new Profession().init({
  _id: 1,
  name: "Alchemist",
  desc: " You decide who wins one duel. You cannot use this ability if you are the attacker or the defender. This ability can be used only once.",
  canUse: function(gameId, userId, target) {
  },
  onUse: function(gameId, userId, target) {
  }
});

Professions.BODYGUARD = new Profession().init({
  _id: 2,
  name: "Bodyguard",
  desc: "The player you support in any duel adds +1 to his score.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.CLAIRVOYANT = new Profession().init({
  _id: 3,
  name: "Clairvoyant",
  desc: "During your turn you can search the objects deck and choose two cards. Shuffle the deck, then place both chosen cards face-down on top of the deck in any order. This ability can be used only once.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.DIPLOMAT = new Profession().init({
  _id: 4,
  name: "Diplomat",
  desc: "Force another player to trade to you a particular object of your choice. You may use this ability only during your turn. If the player does not have the asked for item, your turn ends. This ability can be used only once.",
  canUse: function(gameId, userId, target) {
  },
  onUse: function(gameId, userId, target) {
  }
});

Professions.DOCTOR = new Profession().init({
  _id: 5,
  name: "Doctor",
  desc: "You may cancel the effects of a duel immediately after the duel ends. This ability can be used only once.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.GRAND_MASTER = new Profession().init({
  _id: 6,
  name: "Grand Master",
  desc: "Add +1 to your score in any duel if you are the defender.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.HYPNOTIST = new Profession().init({
  _id: 7,
  name: "Hypnotist",
  desc: "If you are the attacker in any duel you may choose one player. The chosen player may not support either side in this duel.",
  canUse: function(gameId, userId, target) {
  },
  onUse: function(gameId, userId, target) {
  }
});

Professions.PRIEST = new Profession().init({
  _id: 8,
  name: "Priest",
  desc: "You can prevent a duel from taking place. You must use this ability before supporters are revealed. If the attacker holds at least two objects he must give you one of them (his choice). The attacker’s turn ends. This ability can be used only once.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.SWORDSMAN = new Profession().init({
  _id: 9,
  name: "Swordsman",
  desc: "If you are the attacker or defender in any duel you may declare that the other players cannot be involved in this duel. In addition you may add +1 to your score for this duel. This ability can be used only once.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

Professions.THUG = new Profession().init({
  _id: 10,
  name: "Thug",
  desc: "Add +1 to your score in any duel if you are the attacker.",
  canUse: function(gameId, userId) {
  },
  onUse: function(gameId, userId) {
  }
});

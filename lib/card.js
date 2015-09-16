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

getPlayer = function (players, userId) {
  return _.find(players, function(p) {return p._id === userId});
};

var isCombat = function(game) {
  if (game.state.action === Game.PLAY_CARD._id) {
    if (game.state.meta.hasOwnProperty('next_state')) {
      if (game.state.meta.next_state.meta.hasOwnProperty('free_response_meta')) {
        return true;
      }
    }
  }
  return false;
}

Cards = {};

Cards.UNPLAYED = 0;
Cards.PLAYED = 1;

Cards.MOCK = new Card().init({
  _id: 0,
  name: "Mock card",
  desc: "Does nothing",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

/*******************/
/* VICTORY OBJECTS */
/*******************/

Cards.GOBLET = new Card().init({
  _id: 1,
  name: "Goblet",
  desc: "The Society of Open Secrets can proclaim victory if it holds at least 3 Goblets.  Pay attention to the Bag of Secrets - Goblet . It will become a Goblet as soon as the objects deck empties.",
  canUse: function(gameId, user, target) {
    return false;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.KEY = new Card().init({
  _id: 2,
  name: "Key",
  desc: "The Order of True Lies can proclaim victory if it holds at least 3 Keys.  Pay attention to the Bag of Secrets - Key . It will become a Key as soon as the objects deck empties.",
  canUse: function(gameId, user, target) {
    return false;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.LODGE = new Card().init({
  _id: 12,
  name: "Seal of the Lodge",
  desc: "You can proclaim yourself the sole winner, if you hold the Seal of the Lodge and at least 3 Keys and/or Goblets. For example, 2 Keys and 1 Goblet. In this case, you win by yourself without the other members of your Secret Society, who should not even be named! The Bag of Secrets can be used, as usual, only when it has become a Key or a Goblet.",
  canUse: function(gameId, user, target) {
    return false;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

/*****************/
/* TRADE OBJECTS */
/*****************/

Cards.BAG_KEY = new Card().init({
  _id: 3,
  name: "Bag of Secrets (key)",
  desc: "Trade this card in to draw a card. You cannot trade this card for another Bag of Secrets When deck runs out, this turns into a Key",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.BAG_GOBLET = new Card().init({
  _id: 4,
  name: "Bag of Secrets (goblet)",
  desc: "Trade this card in to draw a card. You cannot trade this card for another Bag of Secrets When deck runs out, this turns into a Goblet",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.BLACK_PEARL = new Card().init({
  _id: 5,
  name: "Black Pearl",
  desc: "You must always accept this object if offered in a trade. If you hold the Black Pearl you cannot proclaim victory for your Secret Society. The other members of your Secret Society can still proclaim victory normally, and if the declaration is correct you also win! The Black Pearl prevents you from proclaiming victory even if you have the Seal of the Lodge.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.COAT = new Card().init({
  _id: 6,
  name: "Coat",
  desc: "Trade this object and you can choose a new profession from those left over. Place your new profession face-down in front of you, and add the old one to those left over. The Coat will let you take a profession from the stack of left over professions. Put your old profession back in the stack. Professions that can be used only once may come back into play and be used again.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.MONOCLE = new Card().init({
  _id: 9,
  name: "Monocle",
  desc: "Trade this object and you can look at your trading partner’s Secret Society card.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.PRIVILEGE = new Card().init({
  _id: 11,
  name: "Privilege",
  desc: "Trade this object and you can look at all of your trading partner’s objects.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.SEXTANT = new Card().init({
  _id: 13,
  name: "Sextant",
  desc: "Trade this object and you can choose a direction (right or left). All players must then pass one object of their choice to their neighbor in the chosen direction. Passing an object in this way does not count as a trade. Any trade abilities of passed objects are not activated. The object traded for the Sextant is activated normally even if it is then passed to a neighbor because of the effect of the Sextant.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.SHATTERED_MIRROR = new Card().init({
  _id: 14,
  name: "Shattered Mirror",
  desc: "You must always accept this object if offered in a trade. You cannot use the trade ability of any object you exchange for the Shattered Mirror.  During the trade both objects are kept secret, and change hands without being revealed or read.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.TOME = new Card().init({
  _id: 16,
  name: "Tome",
  desc: "Trade this object and you can exchange your profession with your trading partner. Turn these professions face-down if they were face-up.  Professions that can be used only once may be used again if they are exchanged thanks to the Tome . If they were face up, they are turned face down and can be used again.",
  canUse: function(gameId, user, target) {
    return true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

/******************/
/* COMBAT OBJECTS */
/******************/

Cards.DAGGER = new Card().init({
  _id: 7,
  name: "Dagger",
  desc: "Add +1 to your score in any duel if you are the attacker. You cannot use this bonus if you are supporting another player. You cannot use this object if you are the defender or if you are supporting someone else.",
  canUse: function(gameId, user, target) {
    var game = Games.findOne({_id: gameId});
    return isCombat(game) 
      && getPlayer(game.players, user).attacking === true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.GLOVES = new Card().init({
  _id: 8,
  name: "Gloves",
  desc: "Add +1 to your score in any duel if you are the defender. You cannot use this bonus if you are supporting another player. You cannot use this object if you are the attacker or if you are supporting someone else.",
  canUse: function(gameId, user, target) {
    var game = Games.findOne({_id: gameId});
    return isCombat(game) 
      && getPlayer(game.players, user).defending === true;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.POISON_RING = new Card().init({
  _id: 10,
  name: "Poison Ring",
  desc:  "You win any duel that ends in a tie, if you are either the attacker or the defender. You cannot use this bonus if you are supporting another player. You cannot use this object if you are supporting someone else.",
  canUse: function(gameId, user, target) {
    var game = Games.findOne({_id: gameId});
    return isCombat(game) 
      && (getPlayer(game.players, user).attacking === true
       || getPlayer(game.players, user).defending === true);
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.THROWING_KNIVES = new Card().init({
  _id: 15,
  name: "Throwing Knives",
  desc: "If you support the attacker in any duel, add +1 to his score.  You cannot use this object if you are the attacker or the defender",
  canUse: function(gameId, user, target) {
    var game = Games.findOne({_id: gameId});
    return isCombat(game) 
      && getPlayer(game.players, user).attacking === false
      && getPlayer(game.players, user).defending === false;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

Cards.WHIP = new Card().init({
  _id: 17,
  name: "Whip",
  desc: "If you support the defender in any duel, add +1 to his score.  You cannot use this object if you are the attacker or the defender.",
  canUse: function(gameId, user, target) {
    var game = Games.findOne({_id: gameId});
    return isCombat(game) 
      && getPlayer(game.players, user).attacking === false
      && getPlayer(game.players, user).defending === false;
  },
  onUse: function(gameId, user, target) {
    return true;
  }
});

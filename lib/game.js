Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

getPlayer = function (players, userId) {
  return _.find(players, function(p) {return p._id === userId});
};

getProfById = function(id) {
  return _.find(_.values(Professions), function(prof) {
    return prof._id === id;
  });
};

getCardById = function(id) {
  return _.find(_.values(Cards), function(card) {
    return card._id === id;
  });
};

getActionById = function(id) {
  return _.find(_.values(Game), function(engine) {
    return engine._id === id;
  });
};

ASSOCIATIONS = ["Order of True Lies", "Society of Open Secrets"];

Action = function() {
  this._id = -1;
  this.name = "";
  this.desc = "";
  this.callback = null;
  this.canDoAction = null;
  this.doAction = null;
  this.hooks = [];
  this.init = function (_init) {
    this._id = _init._id;
    this.name = _init.name;
    this.desc = _init.desc;
    this.callback = _init.callback;
    this.canDoAction = _init.canDoAction;
    this.doAction = _init.doAction;
    return this;
  };
  this.addHandler = function(handler) {
    this.hooks.push(handler);
  };
  this.removeHandler = function(predicate) {
    this.hooks = _.reject(hooks, predicate);
  }
};

Game = {};

Game.TURN_START = new Action().init({
  _id: 0,
  name: "TURN_START",
  desc: "Start of the turn",
  callback: function(data) {
  },
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true;
  }
});

Game.PLAY_PROFESSION = new Action().init({
  _id: 1,
  name: "PLAY_PROFESSION",
  desc: "Attempt to play a profession",
  callback: function(data) {
    getProfById(data.prof_id).onUse(data.game_id, data.user);
  },
  canDoAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    return getProfById(game.state.meta.prof_id).canUse(game_id, game.state.user);
  },
  doAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (this.canDoAction(game_id)) {
      return {
        success: true,
        prof_id: game.state.meta.prof_id,
        next_state: {
          action: Game.FREE_RESPONSE._id,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {
            starter: getPlayer(game.state.user).turn,
            callback: {
              type: Game.PLAY_PROFESSION._id,
              data: {
                prof_id: game.state.meta.prof_id,
                user: game.state.user,
                game_id: game_id
              }
            }
          }
        }
      };
    } else {
      return {
        success: false,
        prof_id: game.state.meta.prof_id,
        next_state: {
          action: Game.TURN_START._id,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {}
        }
      };
    }
  }
});

Game.FREE_RESPONSE = new Action().init({
  _id: 2,
  name: "FREE_RESPONSE",
  desc: "Everyone else gets a chance to respond by playing profession/cards",
  callback: function(data) {
  },
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true;
  }
});

Game.DECLARE_VICTORY = new Action().init({
  _id: 3,
  name: "DECLARE_VICTORY",
  desc: "Attempting to declare victory",
  callback: function(data) {
  },
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true;
  }
});

Game.FINISH_DECLARE_VICTORY = new Action().init({
  _id: 4,
  name: "FINISH_DECLARE_VICTORY",
  desc: "End of game screen",
  callback: function(data) {
  },
  canDoAction: function(game_id) {
    return true;
  },
  // check associations of all nominated players
  doAction: function(game_id, nominated_team, nominated_player_ids) {
    if (nominated_player_ids.length === 0) {
      return false;
    }

    var game = Games.findOne({_id: game_id});
    var players = game.players;
    for(var i = 0; i < nominated_player_ids.length; i++) {
      var id = nominated_player_ids[i];
      if (getPlayer(game.players, id).assoc != nominated_team) {
        return false;
      }
    }

    // TODO check cards
    return true;
  },
});


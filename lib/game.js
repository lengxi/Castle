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
  callback: function(data, extraData) {
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId) {
    return true;
  }
});

Game.PLAY_PROFESSION = new Action().init({
  _id: 1,
  name: "PLAY_PROFESSION",
  desc: "Attempt to play a profession",
  callback: function(data, extraData) {
    getProfById(data.prof_id).onUse(data.gameId, data.user);
  },
  canDoAction: function(gameId) {
    var game = Games.findOne({_id: gameId});
    return getProfById(game.state.meta.prof_id).canUse(gameId, game.state.user);
  },
  doAction: function(gameId) {
    var game = Games.findOne({_id: gameId});
    if (this.canDoAction(gameId)) {
      return {
        success: true,
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
                gameId: gameId
              }
            }
          }
        }
      };
    } else {
      return {
        success: false,
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
  callback: function(data, extraData) {
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId) {
    return true;
  }
});

Game.DECLARE_VICTORY = new Action().init({
  _id: 3,
  name: "DECLARE_VICTORY",
  desc: "Attempting to declare victory",
  callback: function(data, extraData) {
    var nominatedTeam = extraData.nominated_team;
    var nominatedPlayerIds = extraData.nominated_player_ids;

    var game = Games.findOne({_id: data.gameId});
    var userId = data.user;
    var players = game.players;

    // function to process and return meta
    var process = function(res) {
      // get winning team and losing team
      var teams = {
        0: [],
        1: []
      };
      for(var i = 0; i < game.players.length; i++) {
        var player = game.players[i];
        teams[player.assoc].push(player._id);
      }

      var winningTeam;
      var declaree_assoc = getPlayer(game.players, userId).assoc;

      if (res) {
        winningTeam = declaree_assoc;
      }
      else {
        winningTeam = declaree_assoc ^ 1; // flip bit
      }

      var meta = {
        success: true,
        res: res,
        nominated_team: nominatedTeam,
        nominated_player_ids: nominatedPlayerIds,
        winning_team_ids: teams[winningTeam],
      };

      Games.update({_id: game._id}, {$set: {"state.meta": meta}});
    };

    if (nominatedPlayerIds.length === 0) {
      process(false);
      return;
    }

    for(var i = 0; i < nominatedPlayerIds.length; i++) {
      var id = nominatedPlayerIds[i];
      if (getPlayer(game.players, id).assoc != nominatedTeam) {
        process(false);
        return;
      }
    }

    // TODO check cards
    process(true);
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId) {
    var game = Games.findOne({_id: gameId});
    return {
      success: false,
      next_state: {
        action: Game.DECLARE_VICTORY._id,
        user: game.state.user,
        wait_on: game.state.user,
        meta: {
          callback: {
            type: Game.DECLARE_VICTORY._id,
            data: {
              gameId: gameId,
              user: game.state.user
            }
          }
        }
      }
    };
  }
});

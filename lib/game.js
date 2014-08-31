Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

var DEBUG = true;

getRealTurn = function(players, turn) {
  var n = players.length;
  return ((turn%n)+n)%n;
};

getPlayer = function (players, userId) {
  return _.find(players, function(p) {return p._id === userId});
};

getPlayerByTurn = function(players, turn) {
  return _.find(players, function(p) {return p.turn === turn});
}

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

// return number of target_id cards player has
playerHasCard = function(player_cards, target_id) {
  var card_ids = _.pluck(player_cards, 'card');
  return _.filter(card_ids, function(id) {
    return id === target_id;
  }).length;
};

getNextPlayer = function(players, id) {
  var nextPlayerTurn = getRealTurn(players, getPlayer(players, id).turn + 1);
  return getPlayerByTurn(players, nextPlayerTurn);
}

getPrevPlayer = function(players, id) {
  var prevPlayerTurn = getRealTurn(players, getPlayer(players, id).turn - 1);
  return getPlayerByTurn(players, prevPlayerTurn);
}

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
    if (getProfById(data.prof).onUse(data.gameId, data.user)) {
      Games.update({_id: data.gameId, "players._id": data.user}, 
          {$set: {"players.$.prof_state": true}});
    }
  },
  canDoAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var player = getPlayer(game.players, userId);
    if (!player.prof_state) {
      return getProfById(player.prof).canUse(gameId, userId);
    }
    return false;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var player = getPlayer(game.players, userId);
    if (this.canDoAction(gameId, userId)) {
      var nextPLayerTurn = getRealTurn(game.players, player.turn + 1);
      var nextPlayer = getPlayerByTurn(game.players, nextPLayerTurn);

      var newMeta = game.state.meta;
      var callback = {
        type: Game.PLAY_PROFESSION._id,
        data: {
          prof: player.prof,
          user: game.state.user,
          gameId: gameId
        }
      };

      //if we got here from FREE_RESPONSE
      if (game.state.meta.hasOwnProperty("num_responses")) { 
        newMeta.callback = callback;
        return {
          success: true,
          prof: player.prof,
          next_state: {
            action: Game.FREE_RESPONSE._id,
            user: game.state.user,
            wait_on: nextPlayer._id,
            meta: newMeta
          }
        };
      } else {
        return {
          success: true,
          prof: player.prof,
          next_state: {
            action: Game.TURN_START._id,
            user: game.state.user,
            wait_on: nextPlayer._id,
            meta: { callback: callback }
          }
        };
      }
    } else {
      //if we got here through FREE_RESPONSE
      if (game.state.meta.hasOwnProperty("num_responses")) {
        game.state.meta.num_responses -= 1;
        return {
          success: false,
          next_state: {
            action: Game.FREE_RESPONSE._id,
            user: game.state.user,
            wait_on: getPrevPlayer(game.players, userId)._id,
            meta: game.state.meta
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
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});

    var nextPlayer = getNextPlayer(game.players, game.state.wait_on)

    // if next player to respond was the initiater
    if (game.state.meta.num_responses === game.players.length) { 
      nextPlayer = getNextPlayer(game.players, nextPlayer._id)
      return {
        action: game.state.meta.done_state.action,
        user: nextPlayer._id,
        wait_on: nextPlayer._id,
        meta: {}
      };
    } else {
      game.state.meta.num_responses++;
      // otherwise move to next player
      return {
        action: Game.FREE_RESPONSE._id,
        user: game.state.user,
        wait_on: nextPlayer._id,
        meta: game.state.meta
      }
    }
  }
});

Game.BEGIN_COMBAT = new Action().init({
  _id: 4,
  name: "BEGIN_COMBAT",
  desc: "Choose someone to attack",
  callback: function(data, extraData) {
    var game = Games.findOne({_id: data.gameId});
    Games.update({_id: data.gameId, "players._id": data.user}, 
          {$set: {"players.$.attacking": true}});
    Games.update({_id: data.gameId, "players._id": extraData.target}, 
          {$set: {"players.$.defending": true}});
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var prevTurn = getRealTurn(game.players, getPlayer(game.players, userId).turn - 1);
    return {
      success: true,
      next_state: {
        action: Game.FREE_RESPONSE._id,
        user: userId,
        wait_on: getPlayerByTurn(game.players, prevTurn)._id,
        meta: {
          num_responses: 0,
          type: Game.BEGIN_COMBAT._id,
          done_state: {
            action: Game.DECLARE_SUPPORT._id,
          },
          callback: {
            type: Game.BEGIN_COMBAT._id,
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

Game.DECLARE_SUPPORT = new Action().init({
  _id: 5,
  name: "DECLARE_SUPPORT",
  desc: "Each player declares who to support",

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

    // each nominated player must have at least one victory item
    // total must be >= numplayers / 2
    var victory_cards = [];
    if (nominatedTeam == 0) { // blue order needs 3 keys and/or key bag 
      victory_cards.push(Cards.KEY._id);
      // TODO add key bag if no more cards in deck
    } else {
      victory_cards.push(Cards.GOBLET._id);
      // TODO add goblet bag if no more cards in deck
    }

    var total_victory = 0;
    for(var i = 0; i < nominatedPlayerIds.length; i++) {
      var id = nominatedPlayerIds[i];
      var player = getPlayer(game.players, id);

      // check association
      if (player.assoc != nominatedTeam) {
        process(false);
        return
      }

      // check victory cards
      var num_victory_cards = 0;
      for (var j = 0; j < victory_cards.length; j++) {
        num_victory_cards += playerHasCard(player.cards, victory_cards[j]);
      }

      if (num_victory_cards === 0) {
        process(false);
        return;
      }

      else {
        total_victory += num_victory_cards;
      }
    }

    if (total_victory >= game.players.length / 2) {
      process(true);
      return;
    }

    process(false);
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

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
  this.addHandler = function(gameId, userId, handlerId) {
    var hook = {
      type: this._id,
      user: userId,
      handler: handlerId
    };
    Games.update({_id: gameId}, {$push: {hooks: hook}});
  };
  this.removeHandler = function(gameId, userId, handlerId) {
    var hook = {
      type: this._id,
      user: userId,
      handler: handlerId
    };
    Games.update({_id: gameId}, {$pull: {hooks: hook}});
  };
  this.getHandlers = function(gameId) {
    var game = Games.find({_id: gameId});
    return _.find(game.hooks, function(hook) {
      return hook.type === this._id;
    });
  };
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
      var nextPlayer = getNextPlayer(game.players, game.state.wait_on);

      var newMeta = game.state.meta;
      var callback = {
        type: Game.PLAY_PROFESSION._id,
        data: {
          prof: player.prof,
          user: userId,
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
            user: nextPlayer._id,
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
            wait_on: game.state.wait_on,
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

    var nextPlayer = getNextPlayer(game.players, game.state.wait_on);

    var computeStateForAction = function(action, nextPlayer) {
      switch(action) {
      case Game.DECLARE_SUPPORT._id:
        var supporters = _.reject(game.players, function(p) {
          return p.attacking || p.defending;
        });

        // greater than 2 players
        if (supporters.length > 0) {
          supporters = _.map(supporters, function(p) {return p._id}).sort();
          return {
            action: action,
            user: game.state.user,
            wait_on: supporters[0],
            meta: {
              supporters: supporters.slice(1)
            }
          };
        } else {
          return { 
            action: Game.RESOLVE_COMBAT._id,
            user: game.state.user,
            wait_on: nextPlayer._id,
            meta: {}
          };
        }
      case Game.RESOLVE_COMBAT._id:
        return {
          action: action,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {
            success: false
          }
        };
      default:
      }

      return {
        action: action,
        user: nextPlayer._id,
        wait_on: nextPlayer._id,
        meta: {}
      };
    };

    // if next player to respond was the initiater
    if (game.state.meta.num_responses === game.players.length) {
      return computeStateForAction(game.state.meta.done_state.action, nextPlayer);
    } else {
      // otherwise move to next player
      game.state.meta.num_responses++;
      return {
        action: Game.FREE_RESPONSE._id,
        user: game.state.user,
        wait_on: game.state.wait_on,
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
    return {
      success: true,
      next_state: {
        action: Game.FREE_RESPONSE._id,
        user: userId,
        wait_on: getNextPlayer(game.players, userId)._id,
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
  callback: function(data, extraData) {
    Games.update({_id: data.gameId, "players._id": data.user}, 
      {$set: {"players.$.supports": data.supports}});
  },
  canDoAction: function(gameId, userId, support) {
    return true;
  },
  doAction: function(gameId, userId, support) {
    var game = Games.findOne({_id: gameId});
    if (this.canDoAction(gameId, userId, support)) {
      var supporters = game.state.meta.supporters;

      if (supporters.length > 0) {
        // move to next supporter on callback
        var newSupporters = supporters.slice(1);

        return {
          success: true,
          supports: support,
          next_state: {
            action: Game.DECLARE_SUPPORT._id,
            user: game.state.user,
            wait_on: supporters[0],
            meta: {
              supporters: newSupporters,
              callback: {
                type: Game.DECLARE_SUPPORT._id,
                data: {
                  gameId: gameId,
                  user: userId,
                  supports: support
                }
              }
            }
          }
        };
      } else {
        // this is last support to be declared, move to free response after callback
        return {
          success: true,
          supports: support,
          next_state: {
            action: Game.FREE_RESPONSE._id,
            user: game.state.user,
            wait_on: getNextPlayer(game.players, game.state.user)._id,
            meta: {
              num_responses: 0,
              type: Game.DECLARE_SUPPORT._id,
              done_state: {
                action: Game.RESOLVE_COMBAT._id,
              },
              callback: {
                type: Game.DECLARE_SUPPORT._id,
                data: {
                  gameId: gameId,
                  user: userId,
                  supports: support
                }
              }
            }
          }
        };
      }
    } else {
      return {
        success: false,
        supports: support,
        next_state: {
          action: Game.DECLARE_SUPPORT._id,
          user: game.state.user,
          wait_on: userId,
          meta: game.state.meta
        }
      }
    }
  }
});

Game.RESOLVE_COMBAT = new Action().init({
  _id: 6,
  name: "RESOLVE_COMBAT",
  desc: "Calculate who won the struggle",
  callback: function(data, extraData) {
    // handles card draw for both players when there is a draw
    if (data.is_draw === true) {
      // update cards
      Games.update({_id: data.gameId, "players._id": data.winner}, 
        {$push: {"players.$.cards": {card: Cards.PRIVILEGE._id, card_state: 0}}});
      Games.update({_id: data.gameId, "players._id": data.loser}, 
        {$push: {"players.$.cards": {card: Cards.BLACK_PEARL._id, card_state: 0}}});
    }
  },
  canDoAction: function(gameId, userId) {
    return true;
  },
  doAction: function(gameId, userId) {
    // only the attacker should be calling this
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var attacker = getPlayer(players, userId);
    var defender = _.find(players, function(p) {return p.defending === true});
    var attackerScore = 1;
    var defenderScore = 1;

    var winner = attacker._id;
    var loser = defender._id;
    var isDraw = false;
    var winnerScore = 1;
    var loserScore = 1;

    if (attacker.attacking === true) {
      var supporters = _.reject(players, function(p) {
        return p._id === attacker._id || p._id === defender._id;});

      for (var supporter in supporters) {
        if (supporter.supports === attacker._id) {
          attackerScore += 1;
        } else if (supporter.supports === defender._id) {
          defenderScore += 1;
        } else {
          throw "Must have supported attacker or defender!";
        }
      }

      if (attackerScore === defenderScore) {
        isDraw = true;
      } else if (attackerScore > defenderScore) {
        winner = userId;
        loser = defender._id;
        winnerScore = attackerScore;
        loserScore = defenderScore;
        isDraw = false;
      } else if (attackerScore > defenderScore) {
        winner = defender._id;
        loser = userId;
        winnerScore = defenderScore;
        loserScore = attackerScore;
        isDraw = false;
      }
    } else {
      throw "Cannot call resolve combat unless you are the attacker!";
    }

    return {
        success: true,
        winner: winner,
        loser: loser,
        is_draw: isDraw,
        winner_score: winnerScore,
        loser_score: loserScore,
        next_state: {
          action: Game.POST_COMBAT._id,
          user: game.state.user,
          wait_on: winner,
          meta: {
            winner: winner,
            loser: loser,
            is_draw: isDraw,
            callback: {
                type: Game.RESOLVE_COMBAT._id,
                data: {
                  gameId: gameId,
                  user: userId,
                  winner: winner,
                  loser: loser,
                  is_draw: isDraw
                }
              }
          }
        }
      }
  }
});

Game.POST_COMBAT = new Action().init({
  _id: 7,
  name: "POST_COMBAT",
  desc: "Handling the effects of the combat",
  callback: function(data, extraData) {
    // 
  },
  canDoAction: function(gameId, userId) {
    // not used
  },
  doAction: function(gameId, userId) {
    // not used
    throw "should not be here";
  }
});

Game.STEAL_CARD = new Action().init({
  _id: 8,
  name: "STEAL_CARD",
  desc: "Choose a card from loser's hand and take it",
  callback: function(data, extraData) {
    // handle stealing, transition into free response.
  },
  canDoAction: function(gameId, userId) {
    // not used
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var loser = getPlayer(players, game.state.meta.loser);
  }
});

Game.STEAL_INFO = new Action().init({
  _id: 9,
  name: "STEAL_INFO",
  desc: "Revealing loser's profession and association",
  callback: function(data, extraData) {
    // handle transition into free response
  },
  canDoAction: function(gameId, userId) {
    // not used
  },
  doAction: function(gameId, userId) {
    // return info about the loser
  }
});

Game.END_TURN = new Action().init({
  _id: 10,
  name: "END_TURN",
  desc: "One last round of free response, then next player's turn.",
  callback: function(data, extraData) {
    // 
  },
  canDoAction: function(gameId, userId) {
    // not used
  },
  doAction: function(gameId, userId) {
    // not used
    throw "should not be here";
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

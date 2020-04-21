Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");
Chats = new Meteor.Collection("chats");

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

// return number of target_id cards player has in a particular state
playerHasCardInState = function(player_cards, target_id, state) {
  return _.filter(player_cards, function(c) {
    return c.card === target_id && c.card_state === state;
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

removeCard = function(cards, id) {
  var newCards = [];
  var removed = false;
  var index;
  for (index = 0; index < cards.length; index++) {
    var card = cards[index];
    if (card.card !== id || removed === true) {
      newCards.push(card);
    } else {
      removed = true;
    }
  }
  return newCards;
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
    var game = Games.findOne({_id: data.gameId});
    if (game.state.meta.success === true) {
      if (getProfById(data.prof).onUse(data.gameId, data.user, extraData)) {
        var newState = Professions.PLAYED;
        if (data.prof === Professions.CLAIRVOYANT._id ||
            data.prof === Professions.DIPLOMAT._id ||
            data.prof === Professions.ALCHEMIST._id ||
            data.prof === Professions.DOCTOR._id ||
            data.prof === Professions.SWORDSMAN._id) {
          newState = Professions.JUST_PLAYED;
        }
        Games.update({_id: data.gameId, "players._id": data.user}, 
            {$set: {"players.$.prof_state": newState}});
      }
    }
  },
  canDoAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var player = getPlayer(game.players, userId);
    if (player.prof_state === Professions.UNPLAYED) {
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
            user: game.state.user,
            wait_on: game.state.user,
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

Game.PLAY_CARD = new Action().init({
  _id: 11,
  name: "PLAY_CARD",
  desc: "Attempt to play a card (combat only)",
  callback: function(data, extraData) {
    // check if card can be played. 
    // set success or failure for post_play_card.
    var game = Games.findOne({_id: data.gameId});

    // player must have the card.
    var player = getPlayer(game.players, data.user);
    var playedCard = parseInt(extraData.played_card);
    if (playerHasCard(player.cards, playedCard) > 0) {
      // must be playable in current state
      if (getCardById(playedCard).canUse(data.gameId, data.user, -1) === true) {
        // update next_state.meta for post_play_card indicating success
        Games.update({_id: data.gameId}, 
          {$set: {"state.meta.next_state.meta.success": true}});
      }
    }

    Games.update({_id: data.gameId}, 
      {$set: {"state.meta.next_state.meta.played_card": playedCard}});
  },
  canDoAction: function(gameId, userId) {
    return true;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    return {
      next_state: {
        action: Game.POST_PLAY_CARD._id,
        user: game.state.user,
        wait_on: game.state.wait_on,
        meta: {
          success: false,
          played_card: -1,
          free_response_meta: game.state.meta,
          callback: {
            type: Game.PLAY_CARD._id,
            data: {
              user: userId,
              gameId: gameId
            }
          },
          next_state: {
            meta: {
              callback: {
                type: Game.POST_PLAY_CARD._id,
                data: {
                  user: userId,
                  gameId: gameId
                }
              }
            }
          }
        }
      }
    };
  }
});

Game.POST_PLAY_CARD = new Action().init({
  _id: 12,
  name: "POST_PLAY_CARD",
  desc: "Handles transitioning out of the playing card state back into the proper free response state",
  callback: function(data, extraData) {
    // perform card playing logic if successful.
    var game = Games.findOne({_id: data.gameId});

    if (game.state.meta.success === true) {
      // set card state to played
      var player = getPlayer(game.players, data.user);
      var cards = player.cards;

      for (var i = 0; i < cards.length; i++) {
        if (cards[i].card === game.state.meta.played_card) {
          cards[i].card_state = Cards.PLAYED;
          break;
        }
      }

      Games.update({_id: data.gameId, "players._id": data.user}, 
        {$set: {"players.$.cards": cards}});
    }

    // set next transition state based on success/free_response_meta
    var newMeta = game.state.meta.free_response_meta;

    if (game.state.meta.success === true) {
      // transition to next player
      var nextPlayer = getNextPlayer(game.players, game.state.wait_on);
      Games.update({_id: data.gameId},
        {$set: {"state.meta.next_state": {
          action: Game.FREE_RESPONSE._id,
          user: game.state.user,
          wait_on: nextPlayer._id,
          meta: newMeta
        }}});
    } else {
      // goes back to same user cuz play card failed
      newMeta.num_responses -= 1;
      Games.update({_id: data.gameId},
        {$set: {"state.meta.next_state": {
          action: Game.FREE_RESPONSE._id,
          user: game.state.user,
          wait_on: game.state.wait_on,
          meta: newMeta
        }}});
    }
  },
  canDoAction: function(gameId, userId) {
    throw "should not be called";
  },
  doAction: function(gameId, userId) {
    throw "should not be called";
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
        var attacker = _.find(game.players, function(p) {return p.attacking === true});
        var defender = _.find(game.players, function(p) {return p.defending === true});
        var supporters = _.reject(game.players, function(p) {
          return p.attacking || p.defending || p.hypnotized;
        });

        var alchemistPlayed = 
            _.filter(game.players, function(p) {return p.destined_winner === true}).length 
                > 0;

        // go to declare support if greater than 2 players 
        // & no swordsman/alchemist activations
        if (supporters.length > 0 && 
            !(attacker.prof === Professions.SWORDSMAN._id &&
              attacker.prof_state === Professions.JUST_PLAYED) &&
            !(defender.prof === Professions.SWORDSMAN._id &&
              defender.prof_state === Professions.JUST_PLAYED) &&
            !alchemistPlayed) {
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
            wait_on: game.state.user,
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
      case Game.TURN_START._id:
        var nextTurn = getNextPlayer(game.players, game.state.user);
        return {
          action: Game.TURN_START._id,
          user: nextTurn._id,
          wait_on: nextTurn._id,
          meta: {}
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

    // Handle hypnosis
    var game = Games.findOne({_id: data.gameId});
    if (extraData.hypnotizedTarget 
      && getPlayer(game.players, data.user).prof === Professions.HYPNOTIST._id) {
      Games.update({_id: data.gameId, "players._id": extraData.hypnotizedTarget}, 
        {$set: {"players.$.hypnotized": true}});
    }
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
      var game = Games.findOne({_id: data.gameId});
      var winner = getPlayer(game.players, data.winner);
      var loser = getPlayer(game.players, data.loser);
      var deck = game.deck;

      // "winner" draw card
      if (deck.length > 0) {
        var drawnCard = deck[0];
        deck.splice(0, 1);
        winner.cards.push({card: drawnCard, card_state: Cards.UNPLAYED});
        Games.update({_id: data.gameId, "players._id": data.winner}, 
            {$set: {deck: deck, "players.$.cards": winner.cards}});
      }

      // "loser" draw card
      if (deck.length > 0) {
        var drawnCard = deck[0];
        deck.splice(0, 1);
        loser.cards.push({card: drawnCard, card_state: Cards.UNPLAYED});
        Games.update({_id: data.gameId, "players._id": data.loser}, 
            {$set: {deck: deck, "players.$.cards": loser.cards}});
      }
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
    var destinedWinner = _.find(players, function(p) {return p.destined_winner === true});
    var hasDestinedWinner = typeof destinedWinner !== "undefined";
    var attackerScore = 1;
    var defenderScore = 1;

    var winner = attacker._id;
    var loser = defender._id;
    var isDraw = false;
    var winnerScore = 1;
    var loserScore = 1;

    // Alchemist used code path
    if (hasDestinedWinner === true) {
      if (destinedWinner.attacking === true) {
        winner = attacker._id;
        loser = defender._id;
        winnerScore = 100000;
        loserScore = 0;
        isDraw = false;
      } else if (destinedWinner.defending === true) {
        winner = defender._id;
        loser = attacker._id;
        winnerScore = 100000;
        loserScore = 0;
        isDraw = false;
      } else {
        throw "Alchemist can only choose attacker or defender";
      }
    }
 
    // No alchemist used code path
    if (hasDestinedWinner === false &&
        attacker.attacking === true) {
      // handle scoring due to basic support (skip if swordsman used)
      var supporters = new Array();
      if (!((attacker.prof === Professions.SWORDSMAN._id &&
          attacker.prof_state === Professions.JUST_PLAYED) ||
          (defender.prof === Professions.SWORDSMAN._id &&
          defender.prof_state === Professions.JUST_PLAYED))) {
        supporters = _.reject(game.players, function(p) {
          return p.attacking || p.defending || p.supports === "undefined" || p.hypnotized;
        });
        for (var index = 0; index < supporters.length; ++index) {
          var supporter = supporters[index];
          if (supporter.supports === attacker._id) {
            attackerScore += 1;
          } else if (supporter.supports === defender._id) {
            defenderScore += 1;
          } else {
            throw "Must have supported attacker or defender!";
          }
        }
      }
      

      // handle scoring due to cards
      if (playerHasCardInState(attacker.cards, Cards.DAGGER._id, Cards.PLAYED)) {
        attackerScore += 1;
      }
      if (playerHasCardInState(defender.cards, Cards.GLOVES._id, Cards.PLAYED)) {
        defenderScore += 1;
      }
      for (var index = 0; index < supporters.length; ++index) {
        var supporter = supporters[index];
        if (supporter.supports === attacker._id &&
            playerHasCardInState(supporter.cards, Cards.THROWING_KNIVES._id, Cards.PLAYED)) {
          attackerScore += 1;
        } else if (supporter.supports === defender._id &&
            playerHasCardInState(supporter.cards, Cards.WHIP._id, Cards.PLAYED)) {
          defenderScore += 1;
        }
      }

      //handle scoring due to professions
      if (attacker.prof === Professions.THUG._id &&
          attacker.prof_state === Professions.PLAYED) {
        attackerScore += 1;
      }
      if (attacker.prof === Professions.SWORDSMAN._id &&
          attacker.prof_state === Professions.JUST_PLAYED) {
        attackerScore += 1;
      }
      if (defender.prof === Professions.GRAND_MASTER._id &&
          defender.prof_state === Professions.PLAYED) {
        defenderScore += 1;
      }
      if (defender.prof === Professions.SWORDSMAN._id &&
          defender.prof_state === Professions.JUST_PLAYED) {
        defenderScore += 1;
      }

      for (var index = 0; index < supporters.length; ++index) {
        var supporter = supporters[index];
        if (supporter.prof === Professions.BODYGUARD._id &&
            supporter.prof_state === Professions.PLAYED) {
          if (supporter.supports === attacker._id) {
            attackerScore += 1;
          } else if (supporter.supports === defender._id) {
            defenderScore += 1;
          }
        }
      }

      // final results
      if (attackerScore === defenderScore) {
        // POISON RING
        if (playerHasCardInState(attacker.cards, Cards.POISON_RING._id, Cards.PLAYED)) {
          winner = attacker._id;
          loser = defender._id;
          winnerScore = attackerScore;
          loserScore = defenderScore;
          isDraw = false;
        } else if (playerHasCardInState(defender.cards, Cards.POISON_RING._id, Cards.PLAYED)) {
          winner = defender._id;
          loser = attacker._id;
          winnerScore = defenderScore;
          loserScore = attackerScore;
          isDraw = false;
        } else {
          isDraw = true;
        }
      } else if (attackerScore > defenderScore) {
        winner = attacker._id;
        loser = defender._id;
        winnerScore = attackerScore;
        loserScore = defenderScore;
        isDraw = false;
      } else if (attackerScore < defenderScore) {
        winner = defender._id;
        loser = attacker._id;
        winnerScore = defenderScore;
        loserScore = attackerScore;
        isDraw = false;
      }
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
  },
  canDoAction: function(gameId, userId) {
    // not used
  },
  doAction: function(gameId, userId) {
    // not used
  }
});

Game.STEAL_CARD = new Action().init({
  _id: 8,
  name: "STEAL_CARD",
  desc: "Choose a card from loser's hand and take it",
  callback: function(data, extraData) {
    // handle stealing
    var game = Games.findOne({_id: data.gameId});
    var players = game.players;
    var loser = getPlayer(players, data.loser);
    var winner = getPlayer(players, data.winner);

    var cardId = parseInt(extraData.stolen_card);
    var newCardsLoser = removeCard(loser.cards, cardId);
    winner.cards.push({card: cardId, card_state: Cards.UNPLAYED});
    var newCardsWinner = winner.cards;

    Games.update({_id: data.gameId, "players._id": data.winner}, 
        {$set: {"players.$.cards": newCardsWinner}});
    Games.update({_id: data.gameId, "players._id": data.loser}, 
        {$set: {"players.$.cards": newCardsLoser}});
  },
  canDoAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    return game.state.meta.winner === userId;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var loser = getPlayer(players, game.state.meta.loser);
    if (this.canDoAction(gameId, userId)) {
      return {
        success: false,
        winner: game.state.meta.winner,
        loser: game.state.meta.loser,
        loser_cards: loser.cards,
        next_state: {
          action: Game.STEAL_CARD._id,
          user: game.state.user,
          wait_on: userId,
          meta: {
            success: true,
            callback: {
              type: Game.STEAL_CARD._id,
              data: {
                gameId: gameId,
                user: userId,
                winner: game.state.meta.winner,
                loser: game.state.meta.loser,
              }
            }
          }
        } 
      }
    } else {
      throw "illegal attempt to steal card";
    }
  }
});

Game.STEAL_INFO = new Action().init({
  _id: 9,
  name: "STEAL_INFO",
  desc: "Revealing loser's profession and association",
  callback: function(data, extraData) {
  },
  canDoAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    return game.state.meta.winner === userId;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var loser = getPlayer(players, game.state.meta.loser);
    if (this.canDoAction(gameId, userId)) {
      return {
        winner: game.state.meta.winner,
        loser: game.state.meta.loser,
        loser_assoc: loser.assoc,
        loser_prof: loser.prof
      }
    }
  }
});

Game.BEGIN_TRADE = new Action().init({
  _id: 13,
  name: "BEGIN_TRADE",
  desc: "Offer a trade to someone",
  callback: function(data, extraData) {
    var game = Games.findOne({_id: data.gameId});
    var players = game.players;
    var user = getPlayer(players, data.user);
    var card = parseInt(extraData.card);

    if (playerHasCard(user.cards, card) > 0) {
      var nextCallback = {
        type: Game.TRADE_RESPONSE._id,
        data: {
          gameId: data.gameId,
          user: game.state.user
        }
      };

      Games.update({_id: data.gameId}, 
        {$set: {"state.meta.success": true,
                "state.meta.next_state.wait_on": extraData.target,
                "state.meta.next_state.meta.success": false,
                "state.meta.next_state.meta.trade_target": extraData.target,
                "state.meta.next_state.meta.trade_card": card,
                "state.meta.next_state.meta.trade_valid": false,
                "state.meta.next_state.meta.callback": nextCallback}});
    }
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    return {
      next_state: {
        action: Game.TRADE_RESPONSE._id,
        user: userId,
        meta: {
          callback: {
            type: Game.BEGIN_TRADE._id,
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

Game.TRADE_RESPONSE = new Action().init({
  _id: 14,
  name: "TRADE_RESPONSE",
  desc: "Respond to trade offer",
  callback: function(data, extraData) {
    var game = Games.findOne({_id: data.gameId});
    // callback from invalid state, reset it back to select response
    if (game.state.meta.success === true 
      && game.state.meta.trade_valid === false) {
      Games.update({_id: data.gameId}, 
        {$set: {"state.meta.success": false},
         $unset: {"state.meta.next_state": ""}});
    } else {
      // do the card trade
      var players = game.players;
      var trader = getPlayer(players, game.state.user);
      var tradee = getPlayer(players, game.state.meta.trade_target);

      var offeredCard = game.state.meta.trade_card;
      var responseCard = game.state.meta.trade_response.card;

      var newCardsTrader = removeCard(trader.cards, offeredCard);
      var newCardsTradee = removeCard(tradee.cards, responseCard);
      newCardsTrader.push({card: responseCard, card_state: Cards.UNPLAYED});
      newCardsTradee.push({card: offeredCard, card_state: Cards.UNPLAYED});

      Games.update({_id: data.gameId, "players._id": trader._id}, 
          {$set: {"players.$.cards": newCardsTrader}});
      Games.update({_id: data.gameId, "players._id": tradee._id}, 
          {$set: {"players.$.cards": newCardsTradee}});
    }
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId, userId, extraData) {
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var user = getPlayer(players, game.state.wait_on);
    var card = parseInt(extraData.card); // response card
    var offeredCard = game.state.meta.trade_card;

    // decline trade
    if (card === -1) {
      // can't decline because got traded black pearl/shattered mirror
      if (game.state.meta.trade_card === Cards.BLACK_PEARL._id
        || game.state.meta.trade_card === Cards.SHATTERED_MIRROR._id) {
        game.state.meta.trade_valid = false;
        game.state.meta.success = true;
        game.state.meta.next_state = {
          meta: {
            callback: {
              type: Game.TRADE_RESPONSE._id,
              data: {
                gameId: gameId,
                user: game.state.user
              }
            }
          }
        };
        return game.state.meta;
      } else {
        return {
          success: true, // go to next screen
          trade_valid: true,
          trade_response: {
            accepted: false,
            card: -1
          }
        };
      }
    // successful trade (has card and not bag for bag)
    } else if (playerHasCard(user.cards, card) > 0
      && !((card === Cards.BAG_KEY._id && offeredCard === Cards.BAG_GOBLET._id)
        || (card === Cards.BAG_GOBLET._id && offeredCard === Cards.BAG_KEY._id))) {
      return {
        success: true,
        trade_valid: true,
        trade_card: game.state.meta.trade_card,
        trade_target: game.state.meta.trade_target,
        trade_response: {
          accepted: true,
          card: card
        },
        next_state: {
          action: Game.RESOLVE_TRADE._id,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {
            success: false,
            trade_card: game.state.meta.trade_card,
            trade_target: game.state.meta.trade_target,
            trade_response_card: card,
            callback: {
              type: Game.TRADE_RESPONSE._id,
              data: {
                gameId: gameId,
                user: game.state.user
              }
            }
          }
        }
      };
    // invalid request sent
    } else {
      game.state.meta.trade_valid = false; // trade response invalid
      game.state.meta.success = true; // go to next screen
      game.state.meta.next_state = {
        meta: {
          callback: {
            type: Game.TRADE_RESPONSE._id,
            data: {
              gameId: gameId,
              user: game.state.user
            }
          }
        }
      };
      return game.state.meta;
    }
  }
});

Game.RESOLVE_TRADE = new Action().init({
  _id: 15,
  name: "RESOLVE_TRADE",
  desc: "Resolve effects of the trade",
  callback: function(data, extraData) {
    // should not get called if done
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId, userId, extraData) {
    var game = Games.findOne({_id: gameId});
    var players = game.players;
    var trader = getPlayer(players, game.state.wait_on);
    var card = parseInt(extraData.resolve_action);

    var target = (trader._id === game.state.user) 
        ? game.state.meta.trade_target : game.state.user;
    var targetPlayer = getPlayer(players, target);

    switch(card) {
      case Cards.BAG_KEY._id:
      case Cards.BAG_GOBLET._id:
        // draw a card
        var deck = game.deck;
        if (deck.length > 0) {
          var drawnCard = deck[0];
          deck.splice(0, 1);
          trader.cards.push({card: drawnCard, card_state: Cards.UNPLAYED});
          Games.update({_id: gameId, "players._id": trader._id}, 
              {$set: {deck: deck, "players.$.cards": trader.cards}});
        }
        break;
      case Cards.COAT._id:
        var exchange = extraData.exchange;
        if (exchange === true) {
          var newProf = parseInt(extraData.new_prof);
          var newDeck = _.without(game.prof_deck, newProf);
          newDeck.push(trader.prof);

          Games.update({_id: gameId, "players._id": trader._id}, 
            {$set: {"players.$.prof": newProf,
                    "players.$.prof_state": Professions.UNPLAYED}});
          Games.update({_id: gameId}, {$set: {"prof_deck": newDeck}});
        }
        break;
      case Cards.MONOCLE._id:
        Games.update({_id: gameId, "players._id": trader._id}, 
            {$set: {"players.$.monocle_target_assoc": targetPlayer.assoc}});
        break;
      case Cards.PRIVILEGE._id:
        Games.update({_id: gameId, "players._id": trader._id}, 
            {$set: {"players.$.privilege_target_cards": targetPlayer.cards}});
        break;
      case Cards.ASTROLABE._id:
        break;
      case Cards.TOME._id:
        var exchange = extraData.exchange;
        if (exchange === true) {
          Games.update({_id: gameId, "players._id": trader._id}, 
            {$set: {"players.$.prof": targetPlayer.prof,
                    "players.$.prof_state": Professions.UNPLAYED}});
          Games.update({_id: gameId, "players._id": target}, 
            {$set: {"players.$.prof": trader.prof,
                    "players.$.prof_state": Professions.UNPLAYED}});
        }
        break;
      default:
        break;
    }

    // still need to handle trade target's resolve
    if (trader._id === game.state.user) {
      return {
        success: true,
        trade_card: game.state.meta.trade_card,
        trade_target: game.state.meta.trade_target,
        trade_response_card: game.state.meta.trade_response_card,
        trade_valid: true,
        next_state: {
          action: Game.RESOLVE_TRADE._id,
          user: game.state.user,
          wait_on: game.state.meta.trade_target,
          meta: {
            success: false,
            trade_card: game.state.meta.trade_card,
            trade_target: game.state.meta.trade_target,
            trade_response_card: game.state.meta.trade_response_card,
            callback: {
              type: Game.RESOLVE_TRADE._id,
              data: {
                gameId: gameId,
                user: game.state.user
              }
            }
          }
        }
      };
    }
    // we are done
    else {
      game.state.meta.success = true;
      return game.state.meta;
    }
  }
});

Game.END_TURN = new Action().init({
  _id: 10,
  name: "END_TURN",
  desc: "End the turn.",
  callback: function(data, extraData) {
  },
  canDoAction: function(gameId) {
    return true;
  },
  doAction: function(gameId, userId) {
    var game = Games.findOne({_id: gameId});
    for (var i = 0; i < game.players.length; i++) {
      var update = {};

      // reset players' attack/defend/support info
      update["players." + i + ".attacking"] = false;
      update["players." + i + ".defending"] = false;
      update["players." + i + ".supports"] = null;
      update["players." + i + ".hypnotized"] = false;
      update["players." + i + ".destined_winner"] = false;

      // reset trade info
      update["players." + i + ".monocle_target_assoc"] = null;
      update["players." + i + ".privilege_target_cards"] = null;

      // reset 1 time use professsions
      if (game.players[i].prof_state === Professions.JUST_PLAYED) {
        update["players." + i + ".prof_state"] = Professions.PLAYED;
      }

      // reset card state
      var cards = _.map(game.players[i].cards, function(c) {
        return {card: c.card, card_state: Cards.UNPLAYED};
      });
      update["players." + i + ".cards"] = cards;

      // commit
      Games.update({_id: gameId}, {$set: update});
    }

    return {
      action: Game.TURN_START._id,
      user: getNextPlayer(game.players, game.state.user)._id,
      wait_on: getNextPlayer(game.players, game.state.user)._id,
      meta: {}
    };
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
    var process = function(res, reason) {
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
        reason: reason,
        next_state: {meta: {}},
      };

      Games.update({_id: game._id}, {$set: {"state.meta": meta}});
    };

    if (nominatedPlayerIds.length === 0) {
      process(false, "No players were nominated!");
      return;
    }

    // each nominated player must have at least one victory item
    // total must be >= numplayers / 2
    var victory_cards = [];
    if (nominatedTeam == 0) {
      victory_cards.push(Cards.GOBLET._id);
      if (game.deck.length === 0) {
        victory_cards.push(Cards.BAG_GOBLET._id);
      }
    } else {
      victory_cards.push(Cards.KEY._id);
      if (game.deck.length === 0) {
        victory_cards.push(Cards.BAG_KEY._id);
      }
    }

    var total_victory = 0;
    for(var i = 0; i < nominatedPlayerIds.length; i++) {
      var id = nominatedPlayerIds[i];
      var player = getPlayer(game.players, id);

      // check association
      if (player.assoc != nominatedTeam) {
        process(false, "A nominated player was on the opposing team!");
        return
      }
      console.log(player.cards);
      console.log(victory_cards);

      // check victory cards
      var num_victory_cards = 0;
      for (var j = 0; j < victory_cards.length; j++) {
        num_victory_cards += playerHasCard(player.cards, victory_cards[j]);
      }

      // every declared player must have at least 1 victory card
      if (num_victory_cards === 0) {
        process(false, "A nominated player did not have any victory objects!");
        return;
      }

      else {
        total_victory += num_victory_cards;
      }
    }

    if (total_victory >= game.players.length / 2) {
      process(true, "");
      return;
    }

    process(false, "Not enough victory objects!");
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

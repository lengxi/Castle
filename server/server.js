
// PUBLICATIONS
Meteor.publish("userData", function () {
  return Meteor.users.find({},
    {fields: {'services.github.username': 1, '_id':1}});
});

Meteor.publish("rooms", function () {
  return Rooms.find();
});

Meteor.publish("games", function () {
    return Games.find({players: {$elemMatch: {_id: this.userId}}});
});



//HELPER FUNCTIONS
function doTransition(gameId, newState, userId, waitOn, meta) {
  var newMeta = Games.findOne({_id: gameId}).state.meta;
  for (var attr in meta) { 
    newMeta[attr] = meta[attr]; 
  }

  var newState = {
    action: newState,
    user: userId,
    wait_on: waitOn,
    meta: newMeta
  };

  Games.update({_id: gameId}, {$set: { state: newState }});
  return newState;
}

// returns array of array
// hand for each player position
// TODO dont' hard code
function dealCards(num_players) {
  var hands = [];
  for (var i = 0; i < num_players; i++) {
    if (i % 2 === 0) {
      hands.push([
        {card: Cards.DAGGER._id, card_state: Cards.UNPLAYED},
        {card: Cards.GLOVES._id, card_state: Cards.UNPLAYED},
        {card: Cards.THROWING_KNIVES._id, card_state: Cards.UNPLAYED},
        {card: Cards.WHIP._id, card_state: Cards.UNPLAYED}
      ]);
    } else {
      hands.push([
        {card: Cards.POISON_RING._id, card_state: Cards.UNPLAYED},
        {card: Cards.WHIP._id, card_state: Cards.UNPLAYED},
        {card: Cards.DAGGER._id, card_state: Cards.UNPLAYED}
      ]);
    }
  }

  return hands;
}

Meteor.methods({
  create_room: function(newUser) {
    if (Rooms.find({creator: newUser._id}).count() < 1) {
      Rooms.insert({creator: newUser._id, users: [newUser]});
    }
  },
  join_room: function(roomId, newUser) {
    Rooms.remove({creator: newUser});
    Rooms.update({users: {$in: [newUser]}}, {$pull: {users: newUser}});
    Rooms.update({_id: roomId}, {$push: {users: newUser}});
  },
  start_game: function(roomId, user) {
    var room = Rooms.findOne({_id: roomId});
    Rooms.remove({_id: roomId});

    var all_hands = dealCards(room.users.length);
    var players = _.map(room.users, function(u, k) {
      var player = {
        _id: u._id,
        turn: k,
        assoc: k % 2,
        prof: Professions.PRIEST._id,
        prof_state: Professions.UNPLAYED,
        cards: all_hands[k],
        attacking: false,
        defending: false,
        supports: null,
        hypnotized: false
      };
      return player;
    });

    var game = {
      players: players,
      state: {
        action: Game.TURN_START._id,
        user: user._id,
        wait_on: user._id,
        meta: {}
      },
      hooks: []
    };

    Games.insert(game);

    return true;
  },

  clear_game: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      Games.remove({_id: gameId});
    }
  },

  handle_callback: function(gameId, userId, extraData) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.meta.hasOwnProperty('next_state')) {
        
        // do whatever needs to be done before we transition
        var next = game.state.meta.next_state;
        if (next.meta.hasOwnProperty('callback')) {
          getActionById(next.meta.callback.type).callback(
            next.meta.callback.data, extraData);
        }

        // reset as callback might change properties of next_state
        game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
        next = game.state.meta.next_state;

        // clean up useless callback data
        if (next.meta.hasOwnProperty('callback')) {
          delete next.meta.callback;
        }

        // transition to next state
        switch(next.action) {
          case Game.TURN_START._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          case Game.PLAY_PROFESSION._id:
            //shouldnt be here, no reason to transition into a user chosen state
            break;
          case Game.POST_PLAY_CARD._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          case Game.POST_COMBAT._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          case Game.DECLARE_SUPPORT._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          case Game.FREE_RESPONSE._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            var res = Game.FREE_RESPONSE.doAction(gameId, userId); 
            Games.update({_id: gameId}, {$set: {state: res}});
            break;
          case Game.DECLARE_VICTORY._id:
            //already handled by the callback
            break;
          case Game.STEAL_CARD._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          case Game.END_TURN._id:
            Games.update({_id: gameId}, {$set: { state: next }});
            break;
          default:
        }
      }
    }
  },

  begin_combat: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.BEGIN_COMBAT._id,
          userId, userId, { success: false });

        var res = Game.BEGIN_COMBAT.doAction(game._id, userId);
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

  declare_support: function(gameId, userId, support) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId && game.state.action === Game.DECLARE_SUPPORT._id) {

        game.state = doTransition(gameId, Game.DECLARE_SUPPORT._id,
          game.state.user, game.state.wait_on, { success: false });

        var res = Game.DECLARE_SUPPORT.doAction(game._id, userId, support);
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

  resolve_combat: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId && game.state.action === Game.RESOLVE_COMBAT._id) {
        var res = Game.RESOLVE_COMBAT.doAction(game._id, userId);
        game.state = doTransition(gameId, Game.RESOLVE_COMBAT._id,
          game.state.user, game.state.wait_on, res);
      }
    }
  },

  steal_card: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId && game.state.action === Game.POST_COMBAT._id) {
        var res = Game.STEAL_CARD.doAction(game._id, userId);
        game.state = doTransition(gameId, Game.STEAL_CARD._id,
          game.state.user, userId, {});
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

  steal_info: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId && game.state.action === Game.POST_COMBAT._id) {
        var res = Game.STEAL_INFO.doAction(game._id, userId);
        game.state = doTransition(gameId, Game.STEAL_INFO._id,
          game.state.user, userId, {});
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

  end_turn: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId) {
        var res = Game.END_TURN.doAction(game._id, userId);
        Games.update({_id: gameId}, {$set: { state: res }});
      }
    }
  },

  play_profession: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.PLAY_PROFESSION._id,
          game.state.user, userId, { success: false });

        var res = getActionById(game.state.action).doAction(game._id, userId);
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

  play_card: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null && game.state.wait_on === userId) {
      game.state = doTransition(gameId, Game.PLAY_CARD._id,
        game.state.user, userId, { success: false });
      var res = getActionById(game.state.action).doAction(game._id, userId);
      Games.update({_id: game._id}, {$set: {"state.meta": res}});
    }
  },

  free_response: function(gameId, userId) {
    // this call is just to pass turn on free response
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.FREE_RESPONSE._id,
          game.state.user, getNextPlayer(game.players, game.state.wait_on)._id, 
          game.state.meta);

        var res = Game.FREE_RESPONSE.doAction(gameId, userId); 
        Games.update({_id: gameId}, {$set: {state: res}});
      }
    }
  },

  // changes game state to declare victory
  declare_victory: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.action === Game.TURN_START._id && 
        game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.DECLARE_VICTORY._id,
          userId, userId, { success: false });

        var res = getActionById(game.state.action).doAction(gameId);
        Games.update({_id: gameId}, {$set: {"state.meta": res}});
      }
    }
  },

});

Meteor.startup(function() {
  Rooms.remove({});
  Games.remove({});
});


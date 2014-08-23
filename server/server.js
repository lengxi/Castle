
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
  var newState = {
    action: newState._id,
    user: userId,
    wait_on: waitOn,
    meta: meta
  };

  Games.update({_id: gameId}, {$set: { state: newState }});
  return newState;
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

    var players = _.map(room.users, function(u, k) {
      var player = {
        _id: u._id,
        turn: k,
        assoc: k % 2,
        prof: Professions.MOCK._id,
        prof_state: 0,
        cards: [ {card: Cards.MOCK._id, card_state: 0},
                 {card: Cards.MOCK._id, card_state: 0},
                 {card: Cards.MOCK._id, card_state: 0}]
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
      }
    };

    Games.insert(game);

    return true;
  },
  handle_callback: function(gameId, userId, extraData) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.meta.hasOwnProperty('next_state')) {
        var next = game.state.meta.next_state;
        // do whatever needs to be done before we transition
        if (next.meta.hasOwnProperty('callback')) {
          getActionById(next.meta.callback.type).callback(
            next.meta.callback.data, extraData);
        }

        // transition to next state
        switch(next.action) {
          case Game.TURN_START._id: 
            game.state = {
              action: next.action,
              user: next.user,
              wait_on: next.user,
              meta: {}
            }
            Games.update({_id: gameId}, {$set: { state: game.state }});
            break;
          case Game.PLAY_PROFESSION._id:
            this.play_profession(gameId, userId);
            break;
          case Game.FREE_RESPONSE._id:
            this.free_response(gameId, userId);
          case Game.DECLARE_VICTORY._id:
          default:
        }
      }
    }
  },
  play_profession: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if ((game.state.action === Game.TURN_START._id ||
           game.state.action === Game.FREE_STATE._id ) &&
          game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.PLAY_PROFESSION,
          userId, userId, { success: false,
              prof_id: getPlayer(game.players, userId).prof });

        var res = getActionById(game.state.action).doAction(game._id);
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },
  free_response: function(gameId, userId) {
    
  },

  // changes game state to declare victory
  declare_victory: function(gameId, userId) {
    var game = Games.findOne({_id: gameId, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if (game.state.action === Game.TURN_START._id && 
        game.state.wait_on === userId) {

        game.state = doTransition(gameId, Game.DECLARE_VICTORY,
          userId, userId, { success: false });

        var res = getActionById(game.state.action).doAction(game._id);
        Games.update({_id: game._id}, {$set: {"state.meta": res}});
      }
    }
  },

});

Meteor.startup(function() {
  Rooms.remove({});
  Games.remove({});
});


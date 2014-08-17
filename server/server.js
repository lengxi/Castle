

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


Meteor.methods({
  create_room: function(newUser) {
    if (Rooms.find({creator: newUser._id}).count() < 1) {
      Rooms.insert({creator: newUser._id, users: [newUser]});
    }
  },
  join_room: function(room_id, newUser) {
    Rooms.remove({creator: newUser});
    Rooms.update({users: {$in: [newUser]}}, {$pull: {users: newUser}});
    Rooms.update({_id: room_id}, {$push: {users: newUser}});
  },
  start_game: function(room_id, user) {
    var room = Rooms.findOne({_id: room_id});
    Rooms.remove({_id: room_id});

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
        action: Engine.TURN_START._id,
        user: user._id,
        wait_on: user._id,
        meta: {}
      }
    };

    Games.insert(game);

    return true;
  },
  play_profession: function(game_id, userId) {
    var game = Games.findOne({_id: game_id, players: {$elemMatch: {_id: userId}}});
    if (game !== null) {
      if ((game.state.action === Engine.TURN_START._id ||
           game.state.action === Engine.FREE_STATE._id ) &&
          game.state.wait_on === userId) {

        game.state = {
            action: Engine.PLAY_PROFESSION._id,
            user: userId,
            wait_on: userId,
            meta: {
              success: false,
              prof_id: getPlayer(game.players, userId).prof
            }
          };

        Games.update({_id: game._id}, {$set: { state: game.state }});

        var res = ENGINE[game.state.action].doAction(game._id);
        if (res.success === true) {
          Games.update({_id: game._id}, {$set: {"state.meta": res}});
        } else {
          Games.update({_id: game._id}, {$set: {state: res.next_state}});
        }
      }
    }
  }
});

Meteor.startup(function() {
  Rooms.remove({});
  Games.remove({});
});


Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

Meteor.publish("userData", function () {
  return Meteor.users.find({_id: this.userId},
                           {fields: {'services': 1}});
});

Meteor.publish("rooms", function () {
  return Rooms.find();
});

Meteor.publish("games", function () {
    return Games.find({players: {$elemMatch: {_id: this.userId}}},
      {fields: {"players.assoc": 0, "players.prof": 0, "players.cards": 0}});
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
    var me = {};

    var players = _.map(room.users, function(u, k) {
      var player = { 
        _id: u._id,
        turn: k,
        assoc: k % 2,
        prof: Professions.MOCK._id,
        cards: [Cards.MOCK._id, Cards.MOCK._id, Cards.MOCK._id]
      };
      if (u._id === user._id) {
        me = player;
      }
      return player;
    });

    var game = {
      me: me,
      players: players,
      state: {
        action: Engine.TURN_START_ACTION._id,
        user: user._id,
        wait_on: user._id,
        meta: {}
      }
    };

    Games.insert(game);

    return true;
  }
});

Meteor.startup(function() {
  Rooms.remove({});
  Games.remove({});
});


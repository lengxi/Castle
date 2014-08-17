

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
        cards: [Cards.MOCK._id, Cards.MOCK._id, Cards.MOCK._id]
      };
      return player;
    });

    var game = {
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


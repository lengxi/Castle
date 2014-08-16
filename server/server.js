Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

Meteor.publish("userData", function () {
  return Meteor.users.find({_id: this.userId},
                           {fields: {'services': 1}});
});

Meteor.publish("rooms", function () {
  return Rooms.find();
});

Meteor.methods({
  create_room: function(newUser) {
    Rooms.insert({users: [newUser]});
  },
  join_room: function(room_id, newUser) {
    Rooms.update({_id: room_id, users: {$nin: [newUser]}}, 
      {$push: {users: newUser}});
  }
});

Meteor.startup(function() {
  Rooms.remove({});
  Games.remove({});
})
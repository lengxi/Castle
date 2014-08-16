Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

Meteor.subscribe('userData');
Meteor.subscribe('rooms');
Meteor.subscribe('games');

Template.home.hasUser = function () {
  return Meteor.user() != null;
};
Template.home.userDisplayName = function () {
  return Meteor.user().services.github.username;
};
Template.home.events({
  'click #create_room': function() {
    Meteor.call('create_room', Meteor.user());
  }
})



Template.rooms.rooms = function() {
  return Rooms.find({});
};



Template.room.events({
  'click #join_room': function () {
    Meteor.call('join_room', this._id, Meteor.user());
  }
});



Template.userName.userDisplayName = function () {
  return this.services.github.username;
};



Template.game.events = {
  'click input': function(){

    var my_id = Session.get('user_id');
    var opponent_id = this._id;

    // let the server handle the collision detection etc.
    var response = Meteor.call('start_game', my_id, opponent_id);
    console.log('--> game started');
  }
};
Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

Meteor.subscribe('userData');
Meteor.subscribe('rooms');
Meteor.subscribe('games');

Handlebars.registerHelper('getDisplayName', function(obj) {
  var user = Meteor.users.findOne({_id: obj._id});
  return user.services.github.username;
});
Handlebars.registerHelper('getProfessionName', function(id) {
  return PROF[id].name;
});

Template.home.hasUser = function () {
  return Meteor.user() != null;
};
Template.home.user = function () {
  return Meteor.user();
};
Template.home.events({
  'click #create_room': function() {
    Meteor.call('create_room', Meteor.user());
  }
})

Template.rooms.rooms = function() {
  return Rooms.find({});
};
Template.room.notCreator = function() {
  return this.creator !== Meteor.user()._id;
}
Template.room.events({
  'click #join_room': function () {
    Meteor.call('join_room', this._id, Meteor.user());
  },
  'click #start_game': function () {
    Meteor.call('start_game', this._id, Meteor.user(), function(e, r) {
      if (r === true) {
        Router.go('game');
      }
    });
  }
});

Template.game.context = function() {
  return Games.findOne();
};
Template.game.get_template_for_action_state = function() {
  return Template.TURN_START_ACTION;
}
Template.game.events = {
  'click input': function(){

  }
};

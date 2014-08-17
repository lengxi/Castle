
Meteor.subscribe('userData');
Meteor.subscribe('rooms');
Meteor.subscribe('games');

Handlebars.registerHelper('getDisplayName', function(id) {
  var user = Meteor.users.findOne({_id: id});
  return user.services.github.username;
});
Handlebars.registerHelper('getProfessionName', function(id) {
  return PROF[id].name;
});

STATE_TEMPLATES = [];
STATE_TEMPLATES[0] = Template.TURN_START;
STATE_TEMPLATES[1] = Template.PLAY_PROFESSION;

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
    Meteor.call('start_game', this._id, Meteor.user());
  }
});

Deps.autorun(function(c) {
  if (Games.find().fetch().length > 0) {
    Router.go('game');
    c.stop();
  }
});

Template.action.my_action_template = function() {
  return STATE_TEMPLATES[Games.findOne().state.action];
}; 



UI.registerHelper('is_my_action', function() {
  return Games.findOne().state.wait_on === Meteor.user()._id;
});

Template.TURN_START.events({
  'click #play_profession': function(event, template) {
    Meteor.call('play_profession', template.data.game._id, Meteor.user()._id);
  }
});

Template.PLAY_PROFESSION.events({
  'click .play_success': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
  },
  'click .play_failure': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
  }
})

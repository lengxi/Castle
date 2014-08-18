
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
STATE_TEMPLATES[2] = Template.FREE_RESPONSE;
STATE_TEMPLATES[3] = Template.DECLARE_VICTORY;
STATE_TEMPLATES[4] = Template.FINISH_DECLARE_VICTORY;

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
  },
  'click #declare_victory': function(event, template) {
    Meteor.call('declare_victory', template.data.game._id, Meteor.user()._id); 
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

UI.registerHelper('did_i_win', function(my_assoc) {
  var game = Games.findOne()
  var nominated_team = game.state.meta.nominated_team
  var declaree_assoc = getPlayer(game.players, game.state.user).assoc
  // declaration successful
  if (game.state.meta.res) {
    // you win if you are on the same team as the person who declared
    return declaree_assoc === my_assoc
  } else { // declaration unsuccessrul
    // you win if you are not on the same team as the declaree
    return declaree_assoc !== my_assoc
  }
});

UI.registerHelper('get_association_name', function(assoc_id) {
  return ASSOCIATIONS[assoc_id];
});

Template.DECLARE_VICTORY.events({
  'click #make_declaration': function(event, template) {
    nominated_team = $("input:radio[name=nominated_team]").val();
    nominated_player_ids = [];
    $("input:checked[name=nominated_player]").each(function() {
      nominated_player_ids.push($(this).val());
    });
    console.log(nominated_player_ids);
    Meteor.call('finish_declare_victory', template.data.game._id, Meteor.user()._id, nominated_team, nominated_player_ids);
    console.log(Games.findOne())
  }

})

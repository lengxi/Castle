Meteor.subscribe('userData');
Meteor.subscribe('rooms');
Meteor.subscribe('games');

Handlebars.registerHelper('getDisplayName', function(id) {
  var user = Meteor.users.findOne({_id: id});
  return user.services.github.username;
});

Handlebars.registerHelper('getProfessionName', function(id) {
  return getProfById(id).name;
});

Handlebars.registerHelper('get_association_name', function(assoc_id) {
  return ASSOCIATIONS[assoc_id];
});

Handlebars.registerHelper('getCard', function(cardId) {
  return getCardById(cardId);
});

Handlebars.registerHelper('getPlayerCardNames', function(user_id) {
  var player = getPlayer(game.players, user_id); 
  var card_ids = _.pluck(player.cards, 'card');
  return _.map(card_ids, function(id) {
    return getCardById(id).name;
  });
});

Handlebars.registerHelper('isInCombat', function() {
  var helper = function(action) {
    return action === Game.BEGIN_COMBAT._id;
  };

  var state = Games.findOne().state;
  return helper(state.action) ||
    (state.action === Game.FREE_RESPONSE._id && helper(state.meta.type));
});

Handlebars.registerHelper('isMe', function(userId) {
  return userId === Meteor.user()._id;
});

Handlebars.registerHelper('hasSupport', function(player) {
  return player._id !== player.supports;
});

Handlebars.registerHelper('isPlayersTurn', function(player) {
  return player._id === Games.findOne().state.user;
});


STATE_TEMPLATES = [];
STATE_TEMPLATES[0] = Template.TURN_START;
STATE_TEMPLATES[1] = Template.PLAY_PROFESSION;
STATE_TEMPLATES[2] = Template.FREE_RESPONSE;
STATE_TEMPLATES[3] = Template.DECLARE_VICTORY;
STATE_TEMPLATES[4] = Template.BEGIN_COMBAT;
STATE_TEMPLATES[5] = Template.DECLARE_SUPPORT;
STATE_TEMPLATES[6] = Template.RESOLVE_COMBAT;
STATE_TEMPLATES[7] = Template.POST_COMBAT;

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

Template.game_layout.events({
  'click #clear_game': function(event, template) {
    Meteor.call('clear_game', template.data.game._id, Meteor.user()._id);
  }
});

UI.registerHelper('is_my_action', function() {
  return Games.findOne().state.wait_on === Meteor.user()._id;
});

/**************/
/* TURN START */
/**************/
Template.TURN_START.events({
  'click #play_profession': function(event, template) {
    Meteor.call('play_profession', template.data.game._id, Meteor.user()._id);
  },
  'click #declare_victory': function(event, template) {
    Meteor.call('declare_victory', template.data.game._id, Meteor.user()._id);
  },
  'click #begin_combat': function(event, template) {
    Meteor.call('begin_combat', template.data.game._id, Meteor.user()._id);
  }
});

/****************/
/* BEGIN COMBAT */
/****************/
Template.BEGIN_COMBAT.events({
  'click #choose_attack': function(event, template) {
    var target = $("input:checked[name=target]").val();
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {
      target: target});
  }
});

/*******************/
/* DECLARE SUPPORT */
/*******************/
Template.DECLARE_SUPPORT.events({
  'click #choose_support': function(event, template) {
    var support = $("input:checked[name=support]").val();
    Meteor.call('declare_support', template.data.game._id, Meteor.user()._id,
      support);
  },
  'click #support_success': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
  }
});

/******************/
/* RESOLVE COMBAT */
/******************/
Template.RESOLVE_COMBAT.events({
  'click #resolve_combat': function(event, template) {
    Meteor.call('resolve_combat', template.data.game._id, Meteor.user()._id);
  },
  'click #post_combat': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
  }
});

/***************/
/* POST COMBAT */
/***************/
Template.POST_COMBAT.events({
  'click #finish_combat': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id);
  },
  'click #choose_card': function(event, template) {
    Meteor.call('steal_card', template.data.game._id, Meteor.user()._id);
  },
  'click #choose_info': function(event, template) {
    Meteor.call('steal_info', template.data.game._id, Meteor.user()._id);
  }
});

/**************/
/* STEAL CARD */
/**************/
Template.STEAL_CARD.events({
  'click #pick_card': function(event, template) {
    var card = $("input:checked[name=steal_card]").val();
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, card);
  },
});

/*******************/
/* PLAY PROFESSION */
/*******************/
Template.PLAY_PROFESSION.events({
  'click .play_success': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  },
  'click .play_failure': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  }
});

/*****************/
/* FREE RESPONSE */
/*****************/
Template.FREE_RESPONSE.events({
  'click #play_profession': function(event, template) {
    Meteor.call('play_profession', template.data.game._id, Meteor.user()._id);
  },
  'click #play_card': function(event, template) {
    Meteor.call('play_card', template.data.game._id, Meteor.user()._id);
  },
  'click #do_nothing': function(event, template) {
    Meteor.call('free_response', template.data.game._id, Meteor.user()._id);
  }
});


/*******************/
/* DECLARE_VICTORY */
/*******************/
Template.DECLARE_VICTORY.events({
  'click #make_declaration': function(event, template) {
    nominatedTeam = $("input:checked[name=nominated_team]").val();
    nominatedPlayerIds = [];
    $("input:checked[name=nominated_player]").each(function() {
      nominatedPlayerIds.push($(this).val());
    });
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {
      nominated_team: nominatedTeam, 
      nominated_player_ids: nominatedPlayerIds});
  }
});

Template.DECLARE_VICTORY.helpers({
  'nominated_team_radio': function(assoc) {
    return me.assoc === assoc ? 'checked' : '';
  },
  'nominated_player_checkbox': function(uid) {
    return me._id === uid ? 'checked' : '';
  },
  'did_i_win': function() {
    var winningTeamIds = this.game.state.meta.winning_team_ids;
    return _.contains(winningTeamIds, me._id);
  }
})

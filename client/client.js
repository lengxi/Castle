Meteor.subscribe('userData');
Meteor.subscribe('rooms');
Meteor.subscribe('games');

Handlebars.registerHelper('getDisplayName', function(id) {
  var user = Meteor.users.findOne({_id: id});
  if (user.services) {
    return user.services.github.username;
  }
  return "";
});

Handlebars.registerHelper('getProfessionName', function(id) {
  return getProfById(id).name;
});

Handlebars.registerHelper('getProfessionDesc', function(id) {
  return getProfById(id).desc;
});

Handlebars.registerHelper('get_association_name', function(assoc_id) {
  return ASSOCIATIONS[assoc_id];
});

Handlebars.registerHelper('getCard', function(cardId) {
  return getCardById(cardId);
});

Handlebars.registerHelper('getCardName', function(cardId) {
  return getCardById(cardId).name;
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

Handlebars.registerHelper('isMeProfession', function(professionId) {
  var player = getPlayer(game.players, Meteor.user()._id);
  return player.prof === professionId;
});

Handlebars.registerHelper('isProfRevealed', function(profState) {
  return profState === Professions.PLAYED
    || profState === Professions.JUST_PLAYED;
});

Handlebars.registerHelper('hasSupport', function(player) {
  return player.supports && player._id !== player.supports;
});

Handlebars.registerHelper('isPlayersTurn', function(player) {
  return player._id === Games.findOne().state.user;
});

Handlebars.registerHelper('playedCards', function(player) {
  var playedCards = _.filter(player.cards, function(c) {
    return c.card_state === Cards.PLAYED;
  });
  var card_ids = _.pluck(playedCards, 'card');
  return _.map(card_ids, function(id) {
    return getCardById(id);
  });
});

STATE_TEMPLATES = {};
STATE_TEMPLATES[0] = Template.TURN_START;
STATE_TEMPLATES[1] = Template.PLAY_PROFESSION;
STATE_TEMPLATES[2] = Template.FREE_RESPONSE;
STATE_TEMPLATES[3] = Template.DECLARE_VICTORY;
STATE_TEMPLATES[4] = Template.BEGIN_COMBAT;
STATE_TEMPLATES[5] = Template.DECLARE_SUPPORT;
STATE_TEMPLATES[6] = Template.RESOLVE_COMBAT;
STATE_TEMPLATES[7] = Template.POST_COMBAT;
STATE_TEMPLATES[8] = Template.STEAL_CARD;
STATE_TEMPLATES[9] = Template.STEAL_INFO;
STATE_TEMPLATES[11] = Template.PLAY_CARD;
STATE_TEMPLATES[12] = Template.POST_PLAY_CARD;
STATE_TEMPLATES[13] = Template.BEGIN_TRADE;
STATE_TEMPLATES[14] = Template.TRADE_RESPONSE;
STATE_TEMPLATES[15] = Template.RESOLVE_TRADE;

Template.home.helpers({
  hasUser: function () {
    return Meteor.user() != null;
  },
  user: function () {
    return Meteor.user();
  }
});
Template.home.events({
  'click #create_room': function() {
    Meteor.call('create_room', Meteor.user());
  }
})

Template.rooms.helpers({
  rooms: function() {
    return Rooms.find({});
  }
});

Template.room.helpers({
  notCreator: function() {
    return this.creator !== Meteor.user()._id;
  }
});

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

Template.action.helpers({
  my_action_template: function() {
    return STATE_TEMPLATES[Games.findOne().state.action];
  }
});

Template.game_layout.events({
  'click #clear_game': function(event, template) {
    Meteor.call('clear_game', template.data.game._id, Meteor.user()._id);
  }
});

UI.registerHelper('is_my_action', function(gameId) {
  return Games.findOne({_id: gameId}).state.wait_on === Meteor.user()._id;
});
UI.registerHelper('is_done', function(gameId) {
  var game = Games.findOne({_id: gameId});
  return game.state.wait_on === game.state.meta.trade_target;
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
  },
  'click #begin_trade': function(event, template) {
    Meteor.call('begin_trade', template.data.game._id, Meteor.user()._id);
  },
  'click #do_nothing': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id);
  }
});

/****************/
/* BEGIN COMBAT */
/****************/
Template.BEGIN_COMBAT.events({
  'click #choose_attack': function(event, template) {
    var target = $("input:checked[name=target]").val();
    var hypnotizedTarget = $("input:checked[name=hypnotizedTarget]").val() || null;
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {
      target: target, hypnotizedTarget: hypnotizedTarget});
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
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, 
      {stolen_card: card});
  },
  'click #finish_combat': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id);
  },
});

/*************/
/* STEAL INFO*/
/*************/
Template.STEAL_INFO.events({
  'click #finish_combat': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id);
  },
});

/*******************/
/* PLAY PROFESSION */
/*******************/
Template.PLAY_PROFESSION.events({
  'click .play_success': function(event, template) {
    var winner = $("input:checked[name=choose_winner]");
    if (winner.length > 0) {
      Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, 
        {winner: winner.val()});
    } else {
      Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
    }
  },
  'click .play_failure': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  }
});

/*************/
/* PLAY CARD */
/*************/
Template.PLAY_CARD.events({
  'click #play_card': function(event, template) {
    var card = $("input:checked[name=play_card]").val();
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, 
      {played_card: card});
  },
});

/******************/
/* POST PLAY CARD */
/******************/
Template.POST_PLAY_CARD.events({
  'click .play_success': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
  },
  'click .play_failure': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id);
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

/***************/
/* BEGIN TRADE */
/***************/
Template.BEGIN_TRADE.events({
  'click #offer_trade': function(event, template) {
    var card = $("input:checked[name=trade_card]").val();
    var target = $("input:checked[name=trade_target]").val();
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {
      card: card, target: target});
  }
});

/******************/
/* TRADE RESPONSE */
/******************/
Template.TRADE_RESPONSE.events({
  'click #accept_trade': function(event, template) {
    var card = $("input:checked[name=trade_card]").val();
    Meteor.call('trade_response', template.data.game._id, Meteor.user()._id, {
      card: card});
  },
  'click #decline_trade': function(event, template) {
    Meteor.call('trade_response', template.data.game._id, Meteor.user()._id, {
      card: -1});
  },
  'click #accept_response': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  },
  'click #decline_response': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id, {});
  },
  'click #invalid_response': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  }
});

/*****************/
/* RESOLVE TRADE */
/*****************/
Template.RESOLVE_TRADE.helpers({
  'is_trader_or_tradee': function(uid) {
    return me._id === this.game.state.meta.trade_target
      || me._id === this.game.state.user;
  },
  'getTradedCardName': function(cid) {
    switch(cid) {
      case Cards.BAG_KEY._id:
      case Cards.BAG_GOBLET._id:
      case Cards.COAT._id:
      case Cards.MONOCLE._id:
      case Cards.PRIVILEGE._id:
      case Cards.ASTROLABE._id:
      case Cards.TOME._id:
        return getCardById(cid).name;
      default:
        return "(unknown)";
    }
  },
  'getTradedCardNameFull': function(cid) {
    return getCardById(cid).name;
  },
  'getCardTemplate': function() {
    var card;
    if (this.game.state.wait_on === this.game.state.user) {
      card = this.game.state.meta.trade_card;
    } else {
      card = this.game.state.meta.trade_response_card;
    }
    switch(card) {
      case Cards.BAG_KEY._id:
        return Template.BAG_KEY;
      case Cards.BAG_GOBLET._id:
        return Template.BAG_GOBLET;
      case Cards.COAT._id:
        return Template.COAT;
      case Cards.MONOCLE._id:
        return Template.MONOCLE;
      case Cards.PRIVILEGE._id:
        return Template.PRIVILEGE;
      case Cards.ASTROLABE._id:
        return Template.ASTROLABE;
      case Cards.TOME._id:
        return Template.TOME;
      default:
        return Template.NO_EFFECT;
    }
  }
});
Template.NO_EFFECT.events({
  'click #resolve_action': function(event, template) {
    Meteor.call('resolve_trade', template.data.game._id, Meteor.user()._id, 
      {resolve_action: -1});
  },
  'click #continue': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  },
  'click #end_turn': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id, {});
  }
});
Template.BAG_KEY.events({
  'click #resolve_action': function(event, template) {
    Meteor.call('resolve_trade', template.data.game._id, Meteor.user()._id, 
      {resolve_action: Cards.BAG_KEY._id});
  },
  'click #continue': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  },
  'click #end_turn': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id, {});
  }
});
Template.BAG_GOBLET.events({
  'click #resolve_action': function(event, template) {
    Meteor.call('resolve_trade', template.data.game._id, Meteor.user()._id, 
      {resolve_action: Cards.BAG_GOBLET._id});
  },
  'click #continue': function(event, template) {
    Meteor.call('handle_callback', template.data.game._id, Meteor.user()._id, {});
  },
  'click #end_turn': function(event, template) {
    Meteor.call('end_turn', template.data.game._id, Meteor.user()._id, {});
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
});

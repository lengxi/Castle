Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

Professions = {};
Cards = {};
Engine = {};
PROF = [];
CARDS = [];

Professions.MOCK = {
  _id: 0,
  name: "Mock Profession",
  desc: "Change your association when you use this. Only if you have 3 or more cards in hand.",
  canUse: function(game_id, user_id, target) {
    var user = Meteor.users.findOne({_id: user_id});
    return user.cards.length > 3;
  },
  onUse: function(game_id, user_id, target) {
    if (this.canUse(game_id, user_id, target)) {
      var user = Meteor.users.findOne({_id: user_id});
      var assoc;
      if (user.assoc === 0) 
        assoc = 1;
      else
        assoc = 0;
      Games.update({_id: game_id, "players._id": user_id}, 
        {$set: {"players.$.assoc": assoc}});
      return true;
    } else {
      return false;
    }
  }
};
PROF[0] = Professions.MOCK;

Cards.MOCK = {
  _id: 0,
  name: "Mock card",
  desc: "Does nothing",
  canUse: function(game_id, user, target) {
    return true;
  },
  onUse: function(game_id, user, target) {
    return true;
  }
};
CARDS[0] = Cards.MOCK;

Engine.TURN_START_ACTION = {
  _id: 0,
  name: "TURN_START_ACTION",
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true;
  }
}

// TODO(Qian)
Engine.DECLARE_VICTORY = {
  _id: 3,
  name: "DECLARE VITORY",
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true
  }

}

Engine.PLAY_PROFESSION = {
  _id: 4,
  canDoAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    return PROF[game.state.meta.prof_id].canUse(game_id, game.state.user);
  },
  doAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (canDoAction(game_id)) {
      PROF[game.state.meta.prof_id].onUse(game_id, game.state.user);
      return true;
    } else {
      return false;
    }
  }
}
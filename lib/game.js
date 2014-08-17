Rooms = new Meteor.Collection("rooms");
Games = new Meteor.Collection("games");

getPlayer = function (players, userId) {
  return _.find(players, function(p) {return p._id === userId});
}

Professions = {};
Cards = {};
Engine = {};
PROF = [];
CARDS = [];
ENGINE = [];

Professions.MOCK = {
  _id: 0,
  name: "Mock Profession",
  desc: "Change your association when you use this. Only if you have 3 or more cards in hand.",
  canUse: function(game_id, user_id, target) {
    var user = getPlayer(Games.findOne({_id: game_id}).players, user_id);
    return user.cards.length >= 3;
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

Engine.TURN_START = {
  _id: 0,
  name: "TURN_START",
  canDoAction: function(game_id) {
    return true;
  },
  doAction: function(game_id) {
    return true;
  }
}
ENGINE[0] = Engine.TURN_START;

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
  _id: 1,
  callback: function(data) {
    PROF[data.prof_id].onUse(data.game_id, data.user);
  },
  canDoAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    return PROF[game.state.meta.prof_id].canUse(game_id, game.state.user);
  },
  doAction: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (this.canDoAction(game_id)) {
      return {
        success: true,
        prof_id: game.state.meta.prof_id,
        next_state: {
          action: Engine.FREE_RESPONSE._id,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {
            starter: getPlayer(game.state.user).turn,
            callback: {
              type: Engine.PLAY_PROFESSION._id,
              data: {
                prof_id: game.state.meta.prof_id,
                user: game.state.user
              }
            }
          }
        }
      };
    } else {
      return {
        success: false,
        next_state: {
          action: Engine.TURN_START._id,
          user: game.state.user,
          wait_on: game.state.user,
          meta: {}
        }
      };
    }
  }
};
ENGINE[1] = Engine.PLAY_PROFESSION;

Engine.FREE_RESPONSE = {
  _id: 2
};

Router.map(function() {
  this.route('home', {path: '/'});
  this.route('game', {
    path: '/',
    template: 'game_layout',
    data: function() {
      game = Games.findOne();
      me = _.find(game.players, function(p) {
            return p._id === Meteor.user()._id;
      });
      return {game:game, me:me}
    }
  });
});

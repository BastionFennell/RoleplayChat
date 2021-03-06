window.App = Ember.Application.create();
(function () {

  var original = document.title;
  var timeout;

  window.flashTitle = function (newMsg, howManyTimes) {
    function step() {
      document.title = (document.title == original) ? newMsg : original;

      if (--howManyTimes > 0) {
        timeout = setTimeout(step, 1000);
      };
    };

    howManyTimes = parseInt(howManyTimes);

    if (isNaN(howManyTimes)) {
      howManyTimes = 5;
    };

    cancelFlashTitle(timeout);
    step();
  };

  window.cancelFlashTitle = function () {
    clearTimeout(timeout);
    document.title = original;
  };
}());

window.onmouseover = function(){
  cancelFlashTitle();
}

App.Store = FP.Store.extend({
    firebaseRoot: "https://snowyrat.firebaseio.com"
});

App.Router.map(function(){
  this.resource("index", {path: "/"}, function() {
    this.route("about", {path: "/about"});
    this.resource("account", {path: "/account"}, function() {
      this.resource("characters", {path: "/characters"}, function() {
        this.resource("newCharacter", {path: "/new"})
      })
    })
    this.resource("rooms", {path: "/rooms"});
    this.resource("room", {path: "/:name"}, function() {
      this.resource("messages", {path: "/chat"});
    })
  });
});

App.Room = FP.Model.extend({
  name: FP.attr(),
  messages: FP.hasMany("message")
});

App.Message = FP.Model.extend({
  body: FP.attr(),
  color: FP.attr()
})

App.IndexRoute = Ember.Route.extend({
  model: function(){
    return new Ember.Object({authenticated: false, user: null})
  }
})

App.AccountRoute = Ember.Route.extend({
  beforeModel: function() {
    if(!this.modelFor("index").authenticated){
      this.transitionTo("index");
    }
    else {
      this.user = this.modelFor("index").get("user.id")
    }
  },
  model: function() {
    return {user: this.user}
  }
});

App.CharactersRoute = Ember.Route.extend({
  model: function(){
    return this.store.fetch("character", {user: this.modelFor("account").user});
  }
});

App.CharactersIndexController = Ember.ArrayController.extend({
  actions: {
    deleteCharacter: function(character) {
      var store = this.store;
      if(confirm("Are you sure you want to delete " + character.get("id") + "?")){
        this.store.fetch("character", {id: character.get("id"), user: 3}).then(function(result) {
          store.deleteRecord(result);
        })
      }
    }
  }
})

App.IndexIndexController = Ember.Controller.extend({
  needs: "index",
  authenticated: Ember.computed.alias("controllers.index.model.authenticated"),
  user: Ember.computed.alias("controllers.index.model.user"),
  actions: {
    logout: function(){
      this.set("controllers.index.model.authenticated", false);

      var chatRef = new Firebase('https://snowyrat.firebaseio.com');
      self = this;
      var auth = new FirebaseSimpleLogin(chatRef, function(error, user) {
        if (error) {
          console.log(error);
        } else if (user) {
          self.set("controllers.index.model.authenticated", true);
        } else {
          self.set("controllers.index.model.authenticated", false);
        }
      });

      auth.logout();
    },
    login: function(){
      var chatRef = new Firebase('https://snowyrat.firebaseio.com');
      var self = this;

      var auth = new FirebaseSimpleLogin(chatRef, function(error, user) {
        if (error) {
          console.log(error);
        } else if (user) {
          self.set("controllers.index.model.authenticated", true);
          self.store.fetch("user", user.id).then(function(result){
            self.set("controllers.index.model.user", result);
          })
        } else {
          //User is logged out
        }
      });

      auth.login('password', {
        email: this.get("username"),
        password: this.get("password")
      })

      this.set("username", "");
      this.set("password", "");
    }
  }
})

App.User = FP.Model.extend({
  name: FP.attr(),
  characters: FP.hasMany("character")
})

App.Character = FP.Model.extend({
  name: FP.attr(),
  description: FP.attr(),
  color: FP.attr()
})

App.MessagesRoute = Ember.Route.extend({
  beforeModel: function(){
    if(!this.modelFor("index").authenticated){
      this.transitionTo("index");
    }
  },
  model: function(){
    return this.store.fetch("message", { room: this.modelFor("room").get("name")});
  }
})

App.CharacterPickerComponent = Ember.Component.extend({
  character: null,
  user: null,
  characters: function(){
    return this.store.find("character", {user: this.get("user")});
  }.property("user"),
  actions: {
    characterPick: function(character){
      this.get("characters.content").forEach(function(character){
        character.set("style", "")
      })
      this.set("character", character.get("id"));
      character.set("style", "background-color:lightgrey;");
    }
  }
})

App.RoomsRoute = Ember.Route.extend({
  roomName: "Test",
  beforeModel: function(){
    if(!this.modelFor("index").authenticated){
      this.transitionTo("index");
    }
  },
  model: function(){
    return this.store.fetch("room");
  }
})

App.RoomsController = Ember.ArrayController.extend({
  needs: ["index"],
  user: function() {
    return this.get("controllers.index.model.user.id");
  }.property("controllers.index.model.user.id"),
  character: null,
  actions: {
    gotoRoom: function(room) {
      if(!!this.get("character")) {
        this.transitionTo("messages", room);
      }
      else {
        alert("You need to select a character!");
      }
    },
    newRoom: function(){
      var room = this.store.createRecord("room", {
        name: this.get("roomName"),
        id: this.get("roomName")
      });
      room.save();
      this.set("roomName", "");
    },
    destroyRoom: function(room){
      var store = this.store;
      if(confirm("Are you sure you want to delete " + room + "?")){
      var room = this.store.fetch("room", room).then(function(result) {
        store.deleteRecord(result);
      })
    }
    }
  }
})

App.RoomRoute = Ember.Route.extend({
  beforeModel: function(){
    if(!this.modelFor("index").authenticated){
      this.transitionTo("index");
    }
  },
  model: function(params){
    return this.store.fetch("room", params.name);
  }
})

App.RoomController = Ember.Controller.extend({
  needs: ["index", "rooms"],
  name: function() {
    return this.get("controllers.rooms.character");
  }.property("controllers.rooms.character"),
  color: "#000000",
  announce: function(){
    var self = this;
    var message = this.store.createRecord("message", {
      body: self.get("name") + " has entered the room",
      color: "color: gray;",
      room: self.get("model.name")
    })
    message.save();
    this.store.fetch("character", {user: self.get("controllers.index.user.id")}).then(function(result){
      var character = result.findBy("id", self.get("name"));
      if(character.get("color")){
        self.set("color", character.get("color"));
      }
      else {
        self.set("color", "#000000");
      }
    });
  }.observes("model", "name"),
  actions:{
    submit: function(){
      if(this.get("message") === "\n"){
        this.set("message", "");
        return;
      }
      var self = this;
      var message = this.store.createRecord("message", {
        body: "[" + self.get("name") + "] " + self.get("message"),
        color: "color:" + this.get("color") + ";",
        room: this.get("model.name")
      })
      message.save();
      this.set("message", "");
      this.store.fetch("character", {user: self.get("controllers.index.user.id")}).then(function(result){
        var character = result.findBy("id", self.get("name"));
        if(character.get("color") != self.get("color")){
          character.set("color", self.get("color"));
          character.save();
        }
      });
      //this.get("controllers.rooms.character").set("color", this.get("color")).save()
    }
  }
})

App.NewCharacterController = Ember.Controller.extend({
  needs: ["account"],
  actions:{
    submit: function(){
      var self = this;
      var character = this.store.createRecord("character", {
        user: self.get("controllers.account.model").user,
        id: self.get("name"),
        description: self.get("description")
      })
      character.save();
      this.transitionTo("characters");
    }
  }
})

App.MessagesController = Ember.ArrayController.extend({
  needs: ["rooms"],
  name: function(){
    return this.get("controllers.rooms.character");
  }.property("controllers.rooms.character"),
  initialize: function() {
    var length = 0;
    var controller = this.get("controller");
    var name = this.get("name");
    window.setInterval(function() {
      if($(".messages").length && this.get("model.length") != length){
        var lastMessage = this.get("model").content.slice(-1)[0].get("body");

        $(".messages").scrollTop($(".messages")[0].scrollHeight);

        var nameRegExp = new RegExp("^\\[" + this.get("name") + "\\]");
        if(!lastMessage.match(nameRegExp) && length != 0) {
          flashTitle("New Message!");
          var audio = new Audio('assets/notification.mp3');
          audio.play();
        }
        length = this.get("model.length");
      }
    }.bind(this), 100);
  }.on("init")
})

App.Room.reopenClass({
  firebasePath: "room"
})

App.Message.reopenClass({
  firebasePath: function(options){
    return "room/" + options.room + "/messages"
  }
})

App.Character.reopenClass({
  firebasePath: function(options){
    if(!!options.id) {
      return "users/" + options.user + "/characters/" + options.id;
    }
    else {
      return "users/" + options.user + "/characters"
    }
  }
})

App.ColoredTextArea = Ember.TextArea.extend({
  attributeBindings: ["style"],
  style: function(){
    return "color:" + this.get("color") + ";width:100%;";
  }.property("color")
});

App.RollerComponentComponent = Ember.Component.extend({
  difficulty: 6,
  dice: 0,
  name: "",
  room: "",
  actions: {
    rollDice: function(){
      var successes = 0;
      var botch = 0;
      var rolls = [];
      for(var i = 0; i < this.get("dice"); i++) {
        var roll = Math.ceil(Math.random() * 10);
        if(roll == 10){
          successes++;
        }
        if(roll >= this.get("difficulty")) {
          successes++;
          botch = 1;
        }
        else if (roll == 1) {
          successes--;
        }
        rolls.push(roll);
      }

      var message = "";

      if(successes < 0) {
        message = this.get("name") + " rolled " + this.get("dice") + " dice at difficulty " + this.get("difficulty") + ". They rolled " + rolls.toString().replace(/,/g, ", ") + " for " + successes + " success.";
      }
      else {
        if(successes == 1) {
          message = this.get("name") + " rolled " + this.get("dice") + " dice at difficulty " + this.get("difficulty") + ". They rolled " + rolls.toString().replace(/,/g, ", ") + " for " + successes + " success.";
        }
        else {
          message = this.get("name") + " rolled " + this.get("dice") + " dice at difficulty " + this.get("difficulty") + ". They rolled " + rolls.toString().replace(/,/g, ", ") + " for " + successes + " successes.";
        }
      }

      this.store.createRecord("message", {
        color: "#000000",
        body: message,
        room: this.get("room")
      }).save()
    }
  }
})

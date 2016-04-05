var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var winston = require('winston');
var expressWinston = require('express-winston');
var mongoosePaginate = require('mongoose-paginate');

// MODELS
var ChallengeGroup = require('../models/challengegroup');
var Challenge = require('../models/challenge');
var Attempt = require('../models/attempt');
var User = require('../models/user');
var Vote = require('../models/vote');
var Location = require('../models/location');
var FB = require('fb');

var jwt = require('jsonwebtoken');
  var router = express.Router();
  router.use(function(req, res, next) {
    console.log('----');
    console.log(req.method + ": " + req.originalUrl);
    console.log(req.body);
    if(req.headers.offset === undefined)
      req.headers.offset = 0;
    if(req.headers.limit === undefined)
      req.headers.limit = 20;
    console.log('----');


    var token = req.headers.token;
    req.headers.auth = false;
    if(token)
    {
      var decoded = jwt.verify(token, 'secret');
      console.log(decoded)
      User.findById(decoded.uid, function(err, user) {
        req.headers.user=user;
        req.headers.auth = true;
        next();
      });
    }

});

router.route('/').get(function(req, res) {
  var Table = require('cli-table');

  var table = new Table({
    head: ['Methods', 'Endpoint']
  });

  router.stack.forEach(function(r) {
    var methods = [];
  
    if (r.route && r.route.path) {
      r.route.stack.forEach(function(s) {
        methods.push(s.method);
      });

      table.push([methods, r.route.path,JSON.stringify(r.keys)]);
      console.log(methods+"\t"+r.route.path);
    }
  });

  console.log(table.toString());
  res.json(router.stack);
});

// Routes for /challenges 
var challengesRoute = router.route('/challenges');

// GET global challenges
challengesRoute.get(function(req, res) {
  var options = {
    populate: 'attempts',
    sort: { 
      challenge_votes: -1,
      updated_on: -1
    },
    offset: parseInt(req.headers.offset), 
    limit: parseInt(req.headers.limit)
  };

  Challenge.paginate({}, options, function(err, challenges) {
    if (err)
      res.send(err);

    res.json(challenges);
  });
});

// POST create a new challenge
challengesRoute.post(function(req, res) {
  console.log(req.body);

  var location = new Location();
  location.name = "Purdue";
  //location.loc = [req.body.latitude, req.body.longitude];
  location.loc = [40.4237, -86.9212];

  var challenge = new Challenge();
  challenge.name = req.body.name;
  challenge.location  = location;
  challenge.description = req.body.description;
  challenge.pattern = req.body.pattern;
  challenge.categories = req.body.categories;
  challenge.created_on = Date.now();
  challenge.updated_on = Date.now();
  challenge.save(function(err) {
    if (err)
      res.send(err);

    res.json({ message: 'Challenge added!', data: challenge });
  });
});

// Route for /challenges/:challenge_id
var challengeDetailRoute = router.route('/challenges/:challenge_id');

// GET challenge details
challengeDetailRoute.get(function(req, res) {
  Challenge.findById(req.params.challenge_id, function(err, challenge) {
    if (err)
      res.send(err);

    res.json(challenge);
  }).populate('attempts');
});

// Route for /challenges/:challenge_id/attempts
var challengeAttemptRoute = router.route('/challenges/:challenge_id/attempts');

// POST submit a challenge attempt
challengeAttemptRoute.post(function(req, res) {
  Challenge.findById(req.params.challenge_id, function(err, challenge) {
    if (err)
      res.send(err);

    var attempt = new Attempt();
  
    attempt.preview_img = "https://placeholdit.imgix.net/~text?txtsize=33&txt=&w=350&h=150"; 
    attempt.gif_img = "https://media.giphy.com/media/xT9DPO1KTBOzoTVr8Y/giphy.gif";
    attempt.challenge =  req.params.challenge_id;
    attempt.save();

    challenge.updated_on = Date.now();
    challenge.attempts.push(attempt);
    challenge.save();

    res.json({ message: 'Attempt Created!', data: attempt });
  });
});

// Route for /challenges/like/:attempt_id
var attemptLikeRoute = router.route('/challenges/like/:attempt_id');

// PATCH like an attempt
attemptLikeRoute.patch(function(req, res) {
  Attempt.findById(req.params.attempt_id, function(err, attempt) {
    if (err)
      res.send(err);

    // Add user to vote list
    attempt.vote_total += 1;
    
    Challenge.findById(attempt.challenge, function(err, challenge) {
      if (err)
        res.send(err);

      challenge.challenge_votes += 1;
      challenge.save();
    });

    attempt.save();

    res.json({ message: 'Vote Recorded!' });
  });
});

// Route for /challenges/local/new
var localNewChallengesRoute = router.route('/challenges/local/new');

localNewChallengesRoute.get(function(req, res) {
  var options = {
    populate: 'attempts',
    sort: {
      updated_on: -1,
      challenge_votes: -1
    },
    offset: parseInt(req.headers.offset), 
    limit: parseInt(req.headers.limit)
  };

  Challenge.paginate({}, options, function(err, challenges) {
    if (err)
      res.send(err);

    res.json(challenges);
  });
});

// Route for /challenges/local/popular
var localPopularChallengesRoute = router.route('/challenges/local/popular');

localPopularChallengesRoute.get(function(req, res) {
  var options = {
    populate: 'attempts',
    sort: { 
      challenge_votes: -1,
      updated_on: -1
    },
    offset: parseInt(req.headers.offset),
    limit: parseInt(req.headers.limit)
  };

  Challenge.paginate({}, options, function(err, challenges) {
    if (err)
      res.send(err);

    res.json(challenges);
  });
});

// Route for /users
var usersRoute = router.route('/users');

// GET all users
usersRoute.get(function(req, res) {
  User.find().exec(function(err, users) {
    if (err)
      res.send(err);

    res.json(users);
  });
});

// POST a user
usersRoute.post(function(req, res) {
  var user = new User();
  user.nickname = req.body.nickname;
  user.facebook_id = req.body.facebook_id;

  if (req.body.settings != undefined) {
    user.settings = req.body.settings.split(",");
  }
  
  user.save(function(err) {
    if (err)
      res.send(err);

    res.json({ message: 'User Created!', data: user })
  });
});

// Route for /users/:user_id
var userDetailRoute = router.route('/users/:user_id');

// GET user details
userDetailRoute.get(function(req, res) {
  User.findById(req.params.user_id, function(err, user) {
    if (err)
      res.send(err);

    res.json(user);
  });
});

// Route for /users/:user_id/bookmarks
var userBookmarkRoute = router.route('/users/:user_id/bookmarks');

// POST a user bookmark
userBookmarkRoute.post(function(req, res) {
  User.findById(req.params.user_id, function(err, user) {
    if (err)
      res.send(err);

    Challenge.findById(req.body.challenge_id, function(err, challenge) {
      if (err) 
        res.send(err);

      user.bookmarks.push(challenge);
      res.json({ message: 'Bookmark Added!', data: challenge });
    });
  });
});

router.route('/me').get(function(req,res) {

  console.log("auth:"+req.headers.auth);

  var token = req.headers.token;
  if(token)
  {
    var decoded = jwt.verify(token, 'secret');
    console.log(decoded)

    User.findById(decoded.uid, function(err, user) {
      res.json(user);
    });
  }
  else
  res.json("oops");

  

});

router.route('/auth/facebook').post(function(req,res) {
  var access_token = req.body.access_token;
  var email = req.body.email;

  var new_account;
  console.log(req.body);
  User.findOne({ 'email': email },function (err, user) {
                if (err || user===null)
                  {
                    console.log("new one");
                    //create a new one
                    user = new User();
                    user.email = email;
                    user.save(function(err) {
                    if (err)
                      console.log(err);
                    });
                    new_account = true;
                  }
                  else
                  {
                      new_account = false;
                  }
                  FB.setAccessToken(access_token);
                  FB.api('me', { fields: ['id', 'name','email'] }, function (fb_res) {
                    user.facebook_id = fb_res.id;
                    if(fb_res.email != email)
                      {
                        res.json({error: "oops"});
                        // console.log("oops emails dont match");
                      }
                      else 
                    {
                      user.save(function(err,u){
                        var uid = u._id;
                        var token = jwt.sign({uid: uid}, 'secret');
                          res.json({ user: user, new_account: new_account, token: token });
                        });
                    }
                  });
              });

});

module.exports = router;

    var AWS = require('aws-sdk');
    var express = require('express');
    var router = express.Router();
    var cookieParser = require('cookie-parser');
    var bodyParser = require('body-parser');
    var expressValidator = require('express-validator');
    var path = require('path');
    var request = require('request');
    const jwt = require('express-jwt');
    const jwtAuthz = require('express-jwt-authz');
    const jwksRsa = require('jwks-rsa');



    if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
      throw 'Make sure you have AUTH0_DOMAIN, and AUTH0_AUDIENCE in your .env file';
    }

    // Authentication middleware. When used, the
    // Access Token must exist and be verified against
    // the Auth0 JSON Web Key Set
    const checkJwt = jwt({
      // Dynamically provide a signing key
      // based on the kid in the header and
      // the signing keys provided by the JWKS endpoint.
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
      }),

      // Validate the audience and the issuer.
      algorithms: ['RS256']
    });

    AWS.config.update({
      region: 'eu-west-1'
    });

    var app = express();
    app.use('/static', express.static(path.join(__dirname,'/static')));
    app.use('/scripts', express.static(__dirname + '/node_modules/'));

    app.use(express.static('rootfiles'));
    app.set('view engine', 'ejs');
    app.set('views', __dirname + '/views');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended:false}));
    app.use(expressValidator());
    app.set('node_modules', __dirname + '/node_modules');
    app.set('models', __dirname + '/models');

    var db = require('./db_connect');
    var port = process.env.PORT || 3000;
    // Connect to MySQL on start
    db.connect(function(err) {
      if (err) {
        console.log('Unable to connect to MySQL.')
        process.exit(1)
      } else {
        var server = app.listen(port, function() {
          console.log('Server running at http://127.0.0.1:' + port + '/')
        })
      }
    })

    var session = require('express-session');
    // config express-session
    var sess = {
      secret: 'ThisisMySecret',
      cookie: {},
      resave: false,
      saveUninitialized: true
    };

    if (app.get('env') === 'production') {
      sess.cookie.secure = true; // serve secure cookies, requires https
    }

    app.use(session(sess));

    var passport = require('passport');
    var Auth0Strategy = require('passport-auth0');

    // Configure Passport to use Auth0
    var strategy = new Auth0Strategy(
      {
        domain: process.env.AUTH0_DOMAIN,
        clientID: process.env.AUTH0_CLIENTID,
        clientSecret: process.env.AUTH0_CLIENT_SECRET,
        callbackURL:
          process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback'
      },
      function (accessToken, refreshToken, extraParams, profile, done) {
        // accessToken is the token to call Auth0 API (not needed in the most cases)
        // extraParams.id_token has the JSON Web Token
        // profile has all the information from the user
        return done(null, profile);
      }
    );

    passport.use(strategy);
    app.use(passport.initialize());
    app.use(passport.session());

    // You can use this section to keep a smaller payload
    passport.serializeUser(function (user, done) {
      done(null, user);
    });

    passport.deserializeUser(function (user, done) {
      done(null, user);
    });


    // Require controller modules
    var venue_controller = require(__dirname + '/controllers/venueController');
    var team_controller = require(__dirname + '/controllers/teamController');
    var player_controller = require(__dirname + '/controllers/playerController');
    var club_controller = require(__dirname + '/controllers/clubController');
    var division_controller = require(__dirname + '/controllers/divisionController');
    var game_controller = require(__dirname + '/controllers/gameController');
    var fixture_controller = require(__dirname + '/controllers/fixtureController');
    var league_controller = require(__dirname + '/controllers/leagueController');
    var userInViews = require(__dirname + '/models/userInViews')
    var secured = require(__dirname + '/models/secured')


  /*  app.get('/', function(req, res) {

        res.render('beta/homepage', {
            static_path: '/static',
            pageTitle : "Homepage",
            pageDescription : "Clubs: Aerospace, Astrazeneca, Altrincham Central, Bramhall Village, CAP, Canute, Carrington, Cheadle Hulme, College Green, David Lloyd, Disley, Dome, GHAP, Macclesfield, Manor, Mellor, New Mills, Parrswood, Poynton, Racketeer, Shell, Syddal Park, Tatton. Social and Competitive badminton in and around Stockport."
        });
    }); */

    app.use(userInViews())

    app.get('/login', passport.authenticate('auth0', {
      scope: 'openid email profile'
    }), function (req, res) {
      res.redirect('/');
    });

    // Perform the final stage of authentication and redirect to previously requested URL or '/user'
    app.get('/callback', function (req, res, next) {
      passport.authenticate('auth0', function (err, user, info) {
        if (err) { return next(err); }
        if (!user) { return res.redirect('/login'); }
        req.logIn(user, function (err) {
          if (err) { return next(err); }
          const returnTo = req.session.returnTo;
          delete req.session.returnTo;
          res.redirect(returnTo || '/user');
        });
      })(req, res, next);
    });

    // Perform session logout and redirect to homepage
    app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/');
    });

    app.get('/user', secured(), function (req, res, next) {
      const { _raw, _json, userProfile } = req.user;
      res.render('beta/user', {
        userProfile: JSON.stringify(userProfile, null, 2),
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "User Profile",
        pageDescription : "User Profile",
      });
    });


    app.get('/scorecard-beta',secured(),function(req,res){
      res.render('index-scorecard',{
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "Scorecard",
        pageDescription : "Enter some results!",
        result:[
          {
            id:7,
            name:"Premier"
          },
          {
            id:8,
            name:"Division 1"
          },
          {
            id:9,
            name:"Division 2"
          },
          {
            id:10,
            name:"Division 3"
          },
          {
            id:11,
            name:"Division 4"
          }
        ]
      })
    })

    const { body,validationResult } = require("express-validator/check");
    const { sanitizeBody } = require("express-validator/filter");

    function greaterThan21(value,{req,path}){
      var otherValue = path.replace('away','home')
      // console.log(otherValue)
      // console.log(value)
      // console.log(path)
      // console.log(req.body[path])
      if (value < 21 && req.body[otherValue] < 21){
          return false
      }
      else{
        return value
      }
    }

    function differenceOfTwo(value,{req,path}){
        var otherValue = path.replace('away','home')
        if (Math.abs(value - req.body[otherValue]) < 2){
          if (value < 30 && req.body[otherValue] < 30){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }
    }

    let validateScorecard = [
      body('Game1homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game1awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game2homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game2awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game3homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game3awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game4homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game4awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game5homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game5awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game6homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game6awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game7homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game7awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game8homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game8awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game9homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game9awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game10homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game10awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game11homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game11awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game12homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game12awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game13homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game13awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game14homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game14awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game15homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game15awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game16homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game16awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game17homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game17awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('Game18homeScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30"),
      body('Game18awayScore').isInt({min:0, max:30}).withMessage("must be between 0 and 30").custom(differenceOfTwo).withMessage("winning score isn't 2 greater than losing score").custom(greaterThan21).withMessage("one of the teams needs to score at least 21"),
      body('homeMan1', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan2 || value == req.body.homeMan3 || value == req.body.awayMan1 || value == req.body.awayMan2 || value == req.body.awayMan3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }
      }).withMessage("can't use the same player more than once"),
      body('homeMan2', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan1 || value == req.body.homeMan3 || value == req.body.awayMan1 || value == req.body.awayMan2 || value == req.body.awayMan3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('homeMan3', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan2 || value == req.body.homeMan1 || value == req.body.awayMan1 || value == req.body.awayMan2 || value == req.body.awayMan3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('homeLady1', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady2 || value == req.body.homeLady3 || value == req.body.awayLady1 || value == req.body.awayLady2 || value == req.body.awayLady3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('homeLady2', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady1 || value == req.body.homeLady3 || value == req.body.awayLady1 || value == req.body.awayLady2 || value == req.body.awayLady3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('homeLady3', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady2 || value == req.body.homeLady1 || value == req.body.awayLady1 || value == req.body.awayLady2 || value == req.body.awayLady3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayMan1', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan2 || value == req.body.homeMan3 || value == req.body.homeMan1 || value == req.body.awayMan2 || value == req.body.awayMan3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayMan2', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan2 || value == req.body.homeMan3 || value == req.body.awayMan1 || value == req.body.awayMan3 || value == req.body.awayMan1){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayMan3', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeMan2 || value == req.body.homeMan3 || value == req.body.awayMan1 || value == req.body.awayMan2 || value == req.body.awayMan1){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayLady1', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady2 || value == req.body.homeLady3 || value == req.body.homeLady1 || value == req.body.awayLady2 || value == req.body.awayLady3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayLady2', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady2 || value == req.body.homeLady3 || value == req.body.homeLady1 || value == req.body.awayLady1 || value == req.body.awayLady3){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once"),
      body('awayLady3', 'Please choose a player.').isInt().custom((value,{req}) => {
        if (value != 0){
          if (value == req.body.homeLady2 || value == req.body.homeLady3 || value == req.body.homeLady1 || value == req.body.awayLady2 || value == req.body.awayLady1){
            return false
          }
          else {
            return value
          }
        }
        else {
          return value
        }

      }).withMessage("can't use the same player more than once")
    ]

    app.post('/scorecard-beta',validateScorecard, fixture_controller.full_fixture_post);

    app.get('/scorecard-received',function(req,res,next){
      res.render('index-scorecard',{
        static_path:'/static',
        theme:process.env.THEME || 'flatly',
        pageTitle : "Scorecard Received - No Errors",
        pageDescription : "Enter some results!",
        scorecardData: req.body
      })
    })

    app.get('/auth0-callback',function(req,res,next){
      console.log('reached auth-callback');
      var options = {
        method:'POST',
        url:'https://'+process.env.AUTH0_DOMAIN+'/oauth/token',
        headers:{
          'content-type':'application/json'
        },
        body:{
          grant_type:'authorization_code',
          client_id:process.env.AUTH0_CLIENTID,
          client_secret:process.env.AUTH0_CLIENT_SECRET,
          code:req.query.code,
          redirect_uri:'https://stockport-badminton.co.uk/auth0-callback'
        },
        json:true
      };
      request(options,function(err,res,body){
        if(err) throw new Error(err);
        console.log(body);
        res.redirect('/protected-page',body)
      })
    })

    app.get('/contact-us', function(req, res) {
        res.render('beta/contact-us-form', {
            static_path: '/static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false',
            pageTitle : "Contact Us",
            pageDescription : "Get in touch with your league representatives, or club secretaries"
        });
    });

    app.get('/messer-rules', function(req, res) {
        res.render('beta/messer-rules', {
            static_path: '/static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false',
            pageTitle : "Messer Tropy Rules",
            pageDescription : "Rules and regulations around the Stockrt and District Badminton Leagues' cup competition"
        });
    });

    app.get('/rules', function(req, res) {
        res.render('beta/rules', {
            static_path: '/static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false',
            pageTitle : "Stockport & District Badminton League Rules",
            pageDescription : "Rules and regulations for the Stockport and District Badminton League"
        });
    });

    app.post('/contact-us', (req, res) => {
      body('contactEmail', 'must enter an email address').not().isEmpty().isEmail();
      body('contactQuery', 'Please enter something in message field.').not().isEmpty();

      sanitizeBody('contactQuery').escape();
      sanitizeBody('contactQuery').trim();

      var errors = validationResult(req);
      if (!errors.isEmpty()) {
          console.log(errors.array());
          res.render('beta/contact-us-form-delivered', {
            pageTitletitle: 'Contact Us - Error',
            pageDescription: 'Sorry we weren\'t able sent your email - something went wrong',
            static_path:'/static',
            theme:'flatly',
            content: errors.array()});
      return;
      }
      else {
      console.log(req.body);
      var params = {
        Destination: { /* required */
          ToAddresses: [
          ],
          BccAddresses: [
            'stockport.badders.results@gmail.com'
          ]
        },
        Message: { /* required */
          Body: {
            Html: {
             Charset: 'UTF-8',
             Data: 'contact from the website:<br />'+ req.body.contactQuery +'<br /> from email address:'+req.body.contactEmail
            }
           },
           Subject: {
            Charset: 'UTF-8',
            Data: 'Somebody is trying to get in touch'
           }
          },
        Source: 'stockport.badders.results@gmail.com', /* required */
        ReplyToAddresses: [
            'stockport.badders.results@gmail.com'
        ],
      };
      var clubEmail = '';
      if(req.body.contactType == 'Clubs'){
        switch (req.body.clubSelect) {
          case 'Aerospace':
            params.Destination.ToAddresses = ['santanareedy@btinternet.com'];
          break;
          case 'AstraZeneca':
            params.Destination.ToAddresses = ['mel.curwen@ntlworld.com'];

          break;
          case 'AltrinchamCentral':
            params.Destination.ToAddresses = ['janecave53@gmail.com'];

          break;
          case 'BramhallQueensgate':
            params.Destination.ToAddresses = ['jjackson1969@btinternet.com'];

          break;
          case 'CAP':
            params.Destination.ToAddresses = ['dave_haigh@hotmail.co.uk'];

          break;
          case 'Canute':
            params.Destination.ToAddresses = ['canutesecretary@gmail.com'];

          break;
          case 'Carrington':
            params.Destination.ToAddresses = ['darrel@thegoughfamily.co.uk'];

          break;
          case 'CheadleHulme':
            params.Destination.ToAddresses = ['doug.grant@ntlworld.com'];

          break;
          case 'CollegeGreen':
            params.Destination.ToAddresses = ['paulakite@yahoo.co.uk'];

          break;
          case 'DavidLloyd':
            params.Destination.ToAddresses = ['dr_barks@yahoo.co.uk'];

          break;
          case 'Disley':
            params.Destination.ToAddresses = ['julian.cherryman@gmail.com','karlcramp@aol.com'];

          break;
          case 'Dome':
            params.Destination.ToAddresses = ['janet_knowles@ymail.com'];

          break;
          case 'GHAP':
            params.Destination.ToAddresses = ['rossowen40@hotmail.com'];

          break;
          case 'Macclesfield':
            params.Destination.ToAddresses = ['sueorwin@btinternet.com'];

          break;
          case 'Manor':
            params.Destination.ToAddresses = ['jo.woolley@tiscali.co.uk'];

          break;
          case 'Mellor':
            params.Destination.ToAddresses = ['enquiries@mellorbadminton.org.uk'];

          break;
          case 'NewMills':
            params.Destination.ToAddresses = ['bandibates@tiscali.co.uk'];

          break;
          case 'ParrsWood':
            params.Destination.ToAddresses = ['mikegreatorex@btinternet.com'];

          break;
          case 'Poynton':
            params.Destination.ToAddresses = ['ian.anderson12@ntlworld.com'];

          break;
          case 'Racketeer':
            params.Destination.ToAddresses = ['theracketeer@hotmail.com'];

          break;
          case 'Shell':
            params.Destination.ToAddresses = ['annawiza@aol.co.uk'];

          break;
          case 'SyddalPark':
            params.Destination.ToAddresses = ['derek.hillesdon@gmail.com'];

          break;
          case 'Tatton':
            params.Destination.ToAddresses = ['plumley123@btinternet.com'];

          break;
          default:
            params.Destination.ToAddresses = ['stockport.badders.results@gmail.com'];

        }
      }
      if (req.body.contactType == 'League'){
        switch (req.body.leagueSelect) {
          case 'results':
            params.Destination.ToAddresses = ['stockport.badders.results@gmail.com','neil.cooper.241180@gmail.com']
            break;
          case 'tournament':
            params.Destination.ToAddresses = ['sueorwin@btinternet.com']
            break;
          case 'league':
            params.Destination.ToAddresses = ['leaguesec.sdbl@gmail.com']
            break;
          case 'chair':
            params.Destination.ToAddresses = ['walkerd.sdbl@gmail.com']
            break;
          case 'messer':
            params.Destination.ToAddresses = ['sueorwin@btinternet.com']
            break;
          case 'junior':
            params.Destination.ToAddresses = ['stuartscoffins@btinternet.com']
            break;
          case 'juniortournament':
            params.Destination.ToAddresses = ['aim@talktalk.net']
            break;
          case 'treasurer':
            params.Destination.ToAddresses = ['rossowen40@hotmail.com']
            break;
          default:
        }
      }

      // Create sendEmail params


      console.log(params);
      var ses = new AWS.SES({apiVersion: '2010-12-01'});

      ses.sendEmail(params, function(err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
        }
        else {
          console.log(data);           // successful response
          res.render('beta/contact-us-form-delivered', {
                static_path: '/static',
                theme: process.env.THEME || 'flatly',
                flask_debug: process.env.FLASK_DEBUG || 'false',
                pageTitle: 'Contact Us - Success',
                pageDescription: 'Succes - we\'ve sent an email to your chosen contact for you'
            });
        }
      });


      }
    });

    /// PLAYER ROUTES ///

    /* GET catalog home page. */
    router.get('/players', player_controller.index);

    /* GET request for creating a Player. NOTE This must come before routes that display Player (uses id) */
    router.get('/player/create', player_controller.player_create_get);

    /* POST request for creating Player. */
    router.post('/player/create', player_controller.player_create);

    /* POST request for creating Player. */
    router.post('/player/createByName',checkJwt, player_controller.player_create_by_name);

    /* POST request for batch creating Fixture. */
    router.post('/player/batch-create',checkJwt, player_controller.player_batch_create);


    /* GET request to delete Player. */
    router.get('/player/:id/delete', player_controller.player_delete_get);

    // POST request to delete Player
    router.delete('/player/:id',checkJwt, player_controller.player_delete);

    /* GET request to update Player. */
    router.get('/player/:id/update', player_controller.player_update_get);

    // PATCH request to update Player
    router.patch('/player/:id',checkJwt, player_controller.player_update_post);

    /* GET request for one Player. */
    router.get('/player/:id', player_controller.player_detail);

    /* GET request for one Player. */
    router.get('/player-stats/division-:divisionId?/:gameType?', player_controller.all_player_stats);

    /* GET request for one Player. */
    router.get('/player-stats', player_controller.all_player_stats);

    /* GET request for one Player. */
    router.get('/eligiblePlayers/:id/:gender', player_controller.eligible_players_list);

    /* GET request for list of all Player items. */
    router.get('/players/club-:clubid?/team-:teamid?/gender-:gender?', player_controller.player_list);

    /// TEAM ROUTES ///

    /* GET request for creating a Team. NOTE This must come before routes that display Team (uses id) */
    router.get('/team/create', team_controller.team_create_get);

    /* POST request for creating Team. */
    router.post('/team/create',checkJwt, team_controller.team_create_post);

    /* POST request for batch creating Fixture. */
    router.post('/team/batch-create',checkJwt, team_controller.teams_batch_create);


    /* GET request to delete Team. */
    router.get('/team/:id/delete', team_controller.team_delete_get);

    // POST request to delete Team
    router.delete('/team/:id',checkJwt, team_controller.team_delete_post);

    /* GET request to update Team. */
    router.get('/team/:id/update', team_controller.team_update_get);

    // POST request to update Team
    router.patch('/team/:id',checkJwt, team_controller.team_update_post);

    /* GET request for one Team. */
    router.get('/team/:id', team_controller.team_detail);

    /* GET request for list of all Team items.
    router.get('/teams/:clubid/:venue/:matchDay', team_controller.team_list); */

    /* GET request for list of all Team items. */
    router.get('/teams', team_controller.team_list);

    /* GET request for list of all Team items. */
    router.post('/teams', team_controller.team_search);

    /// LEAGUE ROUTES ///

    /* GET request for creating a League. NOTE This must come before routes that display League (uses id) */
    router.get('/league/create', league_controller.league_create_get);

    /* POST request for creating League. */
    router.post('/league/create',checkJwt, league_controller.league_create_post);

    /* GET request to delete League. */
    router.get('/league/:id/delete', league_controller.league_delete_get);

    // DELETE request to delete League
    router.delete('/league/:id',checkJwt, league_controller.league_delete);

    /* GET request to update League. */
    router.get('/league/:id/update', league_controller.league_update_get);

    // POST request to update League
    router.patch('/league/:id',checkJwt, league_controller.league_update);

    /* GET request for one League. */
    router.get('/league/:id', league_controller.league_detail);

    /* GET request for list of all League items. */
    router.get('/leagues',checkJwt, league_controller.league_list);

    /* GET request for list of all League items. */
    router.get('/tables/:division', league_controller.league_table);

    /// CLUB ROUTES ///

    /* GET request for creating a Club. NOTE This must come before routes that display Club (uses id) */
    router.get('/club/create', club_controller.club_create_get);

    /* POST request for creating Club. */
    router.post('/club/create',checkJwt, club_controller.club_create_post);

    /* POST request for batch creating Fixture. */
    router.post('/club/batch-create',checkJwt, club_controller.club_batch_create);


    /* GET request to delete Club. */
    router.get('/club/:id/delete', club_controller.club_delete_get);

    // POST request to delete Club
    router.delete('/club/:id',checkJwt, club_controller.club_delete_post);

    /* GET request to update Club. */
    router.get('/club/:id/update', club_controller.club_update_get);

    // POST request to update Club
    router.patch('/club/:id',checkJwt, club_controller.club_update_post);

    /* GET request for one Club. */
    router.get('/club/:id',checkJwt, club_controller.club_detail);

    /* GET request for list of all Club items. */
    router.get('/clubs', club_controller.club_list);

    /* GET request for list of all Club items. */
    router.get('/info/clubs', club_controller.club_list_detail);

    /// DIVISION ROUTES ///

    /* GET request for creating a Division. NOTE This must come before routes that display Division (uses id) */
    router.get('/division/create', division_controller.division_create_get);

    /* POST request for creating Division. */
    router.post('/division/create',checkJwt, division_controller.division_create_post);

    /* POST request for batch creating Fixture. */
    router.post('/division/batch-create',checkJwt, division_controller.division_batch_create);


    /* GET request to delete Division. */
    router.get('/division/:id/delete', division_controller.division_delete_get);

    // POST request to delete Division
    router.delete('/division/:id',checkJwt, division_controller.division_delete_post);

    /* GET request to update Division. */
    router.get('/division/:id/update', division_controller.division_update_get);

    // POST request to update Division
    router.patch('/division/:id',checkJwt, division_controller.division_update_post);

    /* GET request for one Division. */
    router.get('/division/:id',checkJwt, division_controller.division_detail);

    /* GET request for list of all Division items. */
    router.get('/divisions',checkJwt, division_controller.division_list);

    /// FIXTURE ROUTES ///

    /* GET request for creating a Fixture. NOTE This must come before routes that display Fixture (uses id) */
    router.get('/fixture/create', fixture_controller.fixture_create_get);

    /* Get late scorecards (so that i can ping a daily Zap and get an email of them.) */
    router.get('/fixture/outstanding', fixture_controller.getLateScorecards);

    /* POST request for creating Fixture. */
    router.post('/fixture/create',checkJwt, fixture_controller.fixture_create_post);

    /* POST request for batch creating Fixture. */
    router.post('/fixture/batch-create',checkJwt, fixture_controller.fixture_batch_create);

    /* POST request for batch creating Fixture. */
    router.post('/fixture/enter-result',checkJwt, fixture_controller.fixture_update_by_team_name);

    /* POST request for batch creating Fixture. */
    router.post('/fixture/enter-full-result', fixture_controller.full_fixture_post);

    /* POST request for batch creating Fixture. */
    router.patch('/fixture/rearrange',checkJwt, fixture_controller.fixture_rearrange_by_team_name);

    /* POST request for batch creating Fixture. */
    //router.post('/fixture/batch-update',checkJwt, fixture_controller.fixture_batch_update);

    /* GET request to delete Fixture. */
    router.get('/fixture/:id/delete', fixture_controller.fixture_delete_get);

    // POST request to delete Fixture
    router.delete('/fixture/:id',checkJwt, fixture_controller.fixture_delete_post);

    /* GET request to update Fixture. */
    router.get('/fixture/:id/update', fixture_controller.fixture_update_get);

    /* GET request to update Fixture. */
    router.get('/fixture/home-:homeTeam/away-:awayTeam', fixture_controller.fixture_id_from_team_names);

    /* GET request to get fixture id from home and away team ids. */
    router.get('/fixture/homeId-:homeTeam/awayId-:awayTeam', fixture_controller.fixture_id);

    // POST request to update Fixture
    router.patch('/fixture/:id',checkJwt, fixture_controller.fixture_update_post);

    /* GET request for one Fixture. */
    router.get('/fixture/:id',checkJwt, fixture_controller.fixture_detail);

    /* GET request for list of all Fixture items. */
    router.get('/fixture-players', fixture_controller.get_fixture_players_details);

    /* GET request for list of all Fixture items. */
    router.get('/fixtures', fixture_controller.fixture_list);

    router.get('/', fixture_controller.fixture_get_summary);

    /* GET request for list of all Fixture items. */
    router.get('/results/:division', fixture_controller.fixture_detail_byDivision);

    /// GAME ROUTES ///

    /* GET request for creating a Game. NOTE This must come before routes that display Game (uses id) */
    router.get('/game/create', game_controller.game_create_get);

    /* POST request for creating Game. */
    router.post('/game/create',checkJwt, game_controller.game_create_post);

    /* POST request for batch creating Games. */
    router.post('/game/batch-create',checkJwt, game_controller.game_batch_create);

    /* GET request to delete Game. */
    router.get('/game/:id/delete', game_controller.game_delete_get);

    // POST request to delete Game
    router.delete('/game/:id',checkJwt, game_controller.game_delete_post);

    /* GET request to update Game. */
    router.get('/game/:id/update', game_controller.game_update_get);

    // POST request to update Game
    router.patch('/game/:id',checkJwt, game_controller.game_update_post);

    /* GET request for one Game. */
    router.get('/game/:id',checkJwt, game_controller.game_detail);

    /* GET request for list of all Game items. */
    router.get('/games',checkJwt, game_controller.game_list);

    /// VENUE ROUTES ///

    /* GET request for creating a Venue. NOTE This must come before routes that display Venue (uses id) */
    router.get('/venue/create', venue_controller.venue_create_get);

    /* POST request for creating Venue. */
    router.post('/venue/create',checkJwt, venue_controller.venue_create_post);

    /* POST request for batch creating Venue. */
    router.post('/venue/batch-create',checkJwt, venue_controller.venue_batch_create);

    /* GET request to delete Venue. */
    router.get('/venue/:id/delete', venue_controller.venue_delete_get);

    // POST request to delete Venue
    router.delete('/venue/:id',checkJwt, venue_controller.venue_delete_post);

    /* GET request to update Venue. */
    router.get('/venue/:id/update', venue_controller.venue_update_get);

    // POST request to update Venue
    router.patch('/venue/:id',checkJwt, venue_controller.venue_update_post);

    /* GET request for one Venue. */
    router.get('/venue/:id',checkJwt, venue_controller.venue_detail);

    /* GET request for list of all Venue items. */
    router.get('/venues', venue_controller.venue_list);

     app.use('/',router);

    // Handle 404
     app.use(function(req, res) {
        res.status(404);
       res.render('beta/404-error', {
           static_path: '/static',
           pageTitle : "Can't find the page your looking for",
           pageDescription : "HTTP 404 Error"
       });
    });

    // Handle 500
    app.use(function(error, req, res, next) {
        res.status(500);
       res.render('beta/500-error', {
           static_path: '/static',
           pageTitle : "HTTP 500 Error",
           pageDescription : "HTTP 500 Error",
           error:error
       });
    });

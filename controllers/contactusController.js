var Club = require('../models/club.js');
const sgMail = require('@sendgrid/mail');
require('dotenv').config()
var logger = require('logzio-nodejs').createLogger({
  token: process.env.LOGZ_SECRET,
  host: 'listener-uk.logz.io'
});
const { body,validationResult } = require("express-validator/check");
const { sanitizeBody } = require("express-validator/filter");
var axios = require('axios')

function validCaptcha(value,{req}){
  // console.log('https://www.google.com/recaptcha/api/siteverify?secret='+ process.env.RECAPTCHA_SECRET +'&response='+value);
  axios.post("https://www.google.com/recaptcha/api/siteverify?secret="+ process.env.RECAPTCHA_SECRET +"&response="+value)
    .then(response => {
      //console.log(response.request)
      //console.log(response.config)
      //console.log(response.data)
      if (response.data.success){
        console.log('recaptcha sucess')
        return value
      }
      else {
        console.log('recaptcha fail')
        return false
      }
    })
    .catch(err => {
      console.log("error")
      console.log(err)
      return false
    })
}


function containsProfanity(value,{req}){
  var substringsArray = ["mail.ru","@FeedbackMessages","messages exploitation","Financial Strategic Firm","Business Financial Team","Christ","God","http://","http","https","wininphone","corta.co","Cryptocurrency","adultdating","forex","ahole","anus","ash0le","ash0les","asholes","ass","Ass Monkey","Assface","assh0le","assh0lez","asshole","assholes","assholz","asswipe","azzhole","bassterds","bastard","bastards","bastardz","basterds","basterdz","Biatch","bitch","bitches","Blow Job","boffing","butthole","buttwipe","c0ck","c0cks","c0k","Carpet Muncher","cawk","cawks","Clit","cnts","cntz"," cock","cockhead","cock-head","cocks","CockSucker","cock-sucker","crap","cum","cunt","cunts","cuntz","dick","dild0","dild0s","dildo","dildos","dilld0","dilld0s","dominatricks","dominatrics","dominatrix","dyke","enema","f u c k","f u c k e r","fag","fag1t","faget","fagg1t","faggit","faggot","fagit","fags","fagz","faig","faigs","fart","flipping the bird","fuck","fucker","fuckin","fucking","fucks","Fudge Packer","fuk","Fukah","Fuken","fuker","Fukin","Fukk","Fukkah","Fukken","Fukker","Fukkin","g00k","gay","gayboy","gaygirl","gays","gayz","God-damned","h00r","h0ar","h0re","hells","hoar","hoor","hoore","jackoff","jap","japs","jerk-off","jisim","jiss","jizm","jizz","knob","knobs","knobz","kunt","kunts","kuntz","Lesbian","Lezzian","Lipshits","Lipshitz","masochist","masokist","massterbait","masstrbait","masstrbate","masterbaiter","masterbate","masterbates","Motha Fucker","Motha Fuker","Motha Fukkah","Motha Fukker","Mother Fucker","Mother Fukah","Mother Fuker","Mother Fukkah","Mother Fukker","mother-fucker","Mutha Fucker","Mutha Fukah","Mutha Fuker","Mutha Fukkah","Mutha Fukker","n1gr","nastt","nigger;","nigur;","niiger;","niigr;","orafis","orgasim;","orgasm","orgasum","oriface","orifice","orifiss","packi","packie","packy","paki","pakie","paky","pecker","peeenus","peeenusss","peenus","peinus","pen1s","penas","penis","penis-breath","penus","penuus","Phuc","Phuck","Phuk","Phuker","Phukker","polac","polack","polak","Poonani","pr1c","pr1ck","pr1k","pusse","pussee","pussy","puuke","puuker","queer","queers","queerz","qweers","qweerz","qweir","recktum","rectum","retard","sadist","scank","schlong","screwing","semen","sex","sexy","Sh!t","sh1t","sh1ter","sh1ts","sh1tter","sh1tz","shit","shits","shitter","Shitty","Shity","shitz","Shyt","Shyte","Shytty","Shyty","skanck","skank","skankee","skankey","skanks","Skanky","slut","sluts","Slutty","slutz","son-of-a-bitch","tit","turd","va1jina","vag1na","vagiina","vagina","vaj1na","vajina","vullva","vulva","w0p","wh00r","wh0re","whore","xrated","xxx","b!+ch","bitch","blowjob","clit","arschloch","fuck","shit","ass","asshole","b!tch","b17ch","b1tch","bastard","bi+ch","boiolas","buceta","c0ck","cawk","chink","cipa","clits","cock","cum","cunt","dildo","dirsa","ejakulate","fatass","fcuk","fuk","fux0r","hoer","hore","jism","kawk","l3itch","l3i+ch","lesbian","masturbate","masterbat*","masterbat3","motherfucker","s.o.b.","mofo","nazi","nigga","nigger","nutsack","phuck","pimpis","pusse","pussy","scrotum","sh!t","shemale","shi+","sh!+","slut","smut","teets","tits","boobs","b00bs","teez","testical","testicle","titt","w00se","jackoff","wank","whoar","whore","*damn","*dyke","*fuck*","*shit*","@$$","amcik","andskota","arse*","assrammer","ayir","bi7ch","bitch*","bollock*","breasts","butt-pirate","cabron","cazzo","chraa","chuj","Cock*","cunt*","d4mn","daygo","dego","dick*","dike*","dupa","dziwka","ejackulate","Ekrem*","Ekto","enculer","faen","fag*","fanculo","fanny","feces","feg","Felcher","ficken","fitt*","Flikker","foreskin","Fotze","Fu(*","fuk*","futkretzn","gay","gook","guiena","h0r","h4x0r"," hell ","helvete","hoer*","honkey","Huevon","hui","injun","jizz","kanker*","kike","klootzak","kraut","knulle","kuk","kuksuger","Kurac","kurwa","kusi*","kyrpa*","lesbo","mamhoon","masturbat*","merd*","mibun","monkleigh","mouliewop","muie","mulkku","muschi","nazis","nepesaurio","nigger*","orospu","paska*","perse","picka","pierdol*","pillu*","pimmel","piss*","pizda","poontsee","poop","porn","p0rn","pr0n","preteen","pula","pule","puta","puto","qahbeh","queef*","rautenberg","schaffer","scheiss*","schlampe","schmuck","screw","sh!t*","sharmuta","sharmute","shipal","shiz","skribz","skurwysyn","sphencter","spic","spierdalaj","splooge","suka","b00b*","testicle*","titt*","twat","vittu","wank*","wetback*","wichser","wop*","zabourah"];

  if (substringsArray.some(function(v) { if (value.indexOf(v) >= 0) {console.log(v)}; return value.indexOf(v) >= 0; })) {
     logger.log('containsProfanity fail')
    console.log('containsProfanity fail')
    return false
  }
  // if (substringsArray.some(substring=>yourBigString.includes(substring))) {

  // }
  else{
    // console.log('containsProfanity sucess')
     logger.log(value)
    return value
  }
}


exports.validateContactUs = [
  body('contactEmail').not().isEmpty().withMessage('please enter an Email address').isEmail().withMessage('Please enter a valid email address'),
  body('contactQuery').not().isEmpty().withMessage('Please enter something in message field.').custom(containsProfanity).withMessage("Please don't use profanity in the message body"),
  body('g-recaptcha-response').not().custom(validCaptcha).withMessage('your not a human')
]

exports.contactus = function(req, res,next){
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
      console.log("errors array");
      console.log(errors.array());
      res.render('beta/contact-us-form-delivered', {
        pageTitle: 'Contact Us - Error',
        pageDescription: 'Sorry we weren\'t able sent your email - something went wrong',
        message: 'Sorry something went wrong',
        static_path:'/static',
        theme:'flatly',
        content: errors.array()
      });
      return;
  }
  else {

  const msg = {
    to: '',
    cc: 'stockport.badders.results@gmail.com',
    from: 'stockport.badders.results@stockport-badminton.co.uk',
    replyto: req.body.contactEmail,
    templateId:'d-53fc74c4a6cc4b85bb3126418087cf0b',
    dynamic_template_data:{
      "message":req.body.contactQuery,
      "email":req.body.contactEmail
    }
  };
    var clubEmail = '';
    
    if(req.body.contactType == 'Clubs'){
      Club.getById(req.body.clubSelect, function(err,rows){
        if (err){
          console.log(err);
          next(err);
        }
        else {
          // msg.to = rows[0].contactUs;
          msg.to = (rows[0].contactUs.indexOf(',') > 0 ? rows[0].contactUs.split(',') : rows[0].contactUs);
          sgMail.send(msg)
            .then(()=>{
              logger.log(msg);
              res.render('beta/contact-us-form-delivered', {
                  static_path: '/static',
                  theme: process.env.THEME || 'flatly',
                  flask_debug: process.env.FLASK_DEBUG || 'false',
                  pageTitle: 'Contact Us - Success',
                  pageDescription: 'Success - we\'ve sent an email to your chosen contact for you',
                  message: 'Success - we\'ve sent your email to your chosen contact'
              });
            })
            .catch(error => {
              logger.log(error.toString());
              return next("Sorry something went wrong sending your email.");
            })
        }
      })
      
    }
    if (req.body.contactType == 'League'){
      switch (req.body.leagueSelect) {
        case 'results':
          msg.to = ['stockport.badders.results@gmail.com','neil.cooper.241180@gmail.com']
          msg.cc = null;
          break;
        case 'tournament':
          msg.to = ['sueorwin@btinternet.com']
          break;
        case 'league':
          msg.to = ['leaguesec.sdbl@gmail.com']
          break;
        case 'chair':
          msg.to = ['mel.curwen@ntlworld.com']
          break;
        case 'messer':
          msg.to = ['sueorwin@btinternet.com']
          break;
        case 'junior':
          msg.to = ['stuartscoffins@btinternet.com']
          break;
        case 'juniortournament':
          msg.to = ['aim@talktalk.net']
          break;
        case 'treasurer':
          msg.to = ['rossowen40@hotmail.com']
          break;
        default:
      }
      sgMail.send(msg)
      .then(()=>{
        logger.log(msg);
        res.render('beta/contact-us-form-delivered', {
            static_path: '/static',
            theme: process.env.THEME || 'flatly',
            flask_debug: process.env.FLASK_DEBUG || 'false',
            pageTitle: 'Contact Us - Success',
            pageDescription: 'Success - we\'ve sent an email to your chosen contact for you',
            message: 'Success - we\'ve sent your email to your chosen contact'
        });
      })
      .catch(error => {
        logger.log(error.toString());
        return next("Sorry something went wrong sending your email.");
      })
    }
  }
}

exports.contactus_get = function(req, res,next) {
  Club.getAll(function(err,rows){
    if(err){
      console.log(err);
      next(err);
    }
    else {
      res.render('beta/contact-us-form', {
        static_path: '/static',
        theme: process.env.THEME || 'flatly',
        flask_debug: process.env.FLASK_DEBUG || 'false',
        pageTitle : "Contact Us",
        pageDescription : "Get in touch with your league representatives, or club secretaries",
        recaptcha : process.env.RECAPTCHA,
        clubs:rows
      });
    }
      
  })
  
}

exports.generateReminderHTML = function (){
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=Edge">
  <!--<![endif]-->
  <!--[if (gte mso 9)|(IE)]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <!--[if (gte mso 9)|(IE)]>
<style type="text/css">
body {width: 600px;margin: 0 auto;}
table {border-collapse: collapse;}
table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
img {-ms-interpolation-mode: bicubic;}
</style>
<![endif]-->
  <style type="text/css">
body, p, div {
  font-family: arial,helvetica,sans-serif;
  font-size: 14px;
}
body {
  color: #000000;
}
body a {
  color: #1188E6;
  text-decoration: none;
}
p { margin: 0; padding: 0; }
table.wrapper {
  width:100% !important;
  table-layout: fixed;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
  -moz-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}
img.max-width {
  max-width: 100% !important;
}
.column.of-2 {
  width: 50%;
}
.column.of-3 {
  width: 33.333%;
}
.column.of-4 {
  width: 25%;
}
ul ul ul ul  {
  list-style-type: disc !important;
}
ol ol {
  list-style-type: lower-roman !important;
}
ol ol ol {
  list-style-type: lower-latin !important;
}
ol ol ol ol {
  list-style-type: decimal !important;
}
@media screen and (max-width:480px) {
  .preheader .rightColumnContent,
  .footer .rightColumnContent {
    text-align: left !important;
  }
  .preheader .rightColumnContent div,
  .preheader .rightColumnContent span,
  .footer .rightColumnContent div,
  .footer .rightColumnContent span {
    text-align: left !important;
  }
  .preheader .rightColumnContent,
  .preheader .leftColumnContent {
    font-size: 80% !important;
    padding: 5px 0;
  }
  table.wrapper-mobile {
    width: 100% !important;
    table-layout: fixed;
  }
  img.max-width {
    height: auto !important;
    max-width: 100% !important;
  }
  a.bulletproof-button {
    display: block !important;
    width: auto !important;
    font-size: 80%;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .columns {
    width: 100% !important;
  }
  .column {
    display: block !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .social-icon-column {
    display: inline-block !important;
  }
}
</style>
  <!--user entered Head Start-->

 <!--End Head user entered-->
</head>
<body>
  <center class="wrapper" data-link-color="#1188E6" data-body-style="font-size:14px; font-family:arial,helvetica,sans-serif; color:#000000; background-color:#ffffff;">
    <div class="webkit">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#ffffff">
        <tr>
          <td valign="top" bgcolor="#ffffff" width="100%">
            <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="100%">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <!--[if mso]>
<center>
<table><tr><td width="600">
<![endif]-->
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">
                                  <tr>
                                    <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#ffffff" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
<tr>
  <td role="module-content">
    <p>The Scorecard for your recent match is due</p>
  </td>
</tr>
</table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-mc-module-version="2019-10-22">
  <tr>
    <td style="background-color:#343a40;padding:18px 10px 18px 10px;line-height:22px;text-align:inherit;" height="100%" valign="top" bgcolor="#343a40">
        <div><span style="color:#FFFFFF;"><span style="font-size:24px;">Stockport &amp; District Badminton League</span></span></div>
    </td>
  </tr>
</table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-mc-module-version="2019-10-22">
  <tr>
    <td style="padding:18px 05px 18px 05px;line-height:22px;text-align:justify;" height="100%" valign="top" bgcolor="">
        <div>Just a timely reminder that the scorecard for your recent match is due by close of play tomorrow to avoid a late card mark</div>

<div>&nbsp;</div>

<div>Thanks</div>

<div>&nbsp;</div>

<div>Neil</div>
    </td>
  </tr>
</table></td>
                                  </tr>
                                </table>
                                <!--[if mso]>
                              </td>
                            </tr>
                          </table>
                        </center>
                        <![endif]-->
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </center>
</body>
</html>
  `
}
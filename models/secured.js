module.exports = function() {
  return function secured (req, res, next) {
    if (req.user) { 
      console.log(req.user);
      return next(); 
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  };
};

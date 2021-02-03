const path = require('path'); // nodejs path package used for path.join()

const express = require('express');
const bodyParser = require('body-parser'); // for parsing the request(urlencoded form data)
const mongoose = require('mongoose'); // package for mongodb connection
const session = require('express-session'); // for using sessions
const MongoDBStore = require('connect-mongodb-session')(session); // for connecting mongodb to the session
const csrf = require('csurf'); // csurf is for csrf protection
const flash = require('connect-flash');
const multer = require('multer');

const errorController = require('./controllers/error');
const shopController = require('./controllers/shop');
const isAuth = require('./middleware/is-auth');
const User = require('./models/user');

const MONGODB_URI =
  'mongodb+srv://maximilian:9u4biljMQc4jjqbe@cluster0-ntrwp.mongodb.net/shop';

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});
const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  }
}); 

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(
  multer({
    storage: fileStorage,
    fileFilter: fileFilter
  }).single('image')
);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(
  session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
    store: store
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch(err => {
      next(new Error(err));
    });
});

app.post('/create-order', isAuth, shopController.postOrder);

app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // res.locals is used to add the csrfToken to the response so that view knows that user is authenticated or not
  next();
});

app.use('/admin', adminRoutes); // all the admin routes
app.use(shopRoutes); // all the shop routes
app.use(authRoutes); // all the auth routes

app.get('/500', errorController.get500); // 500 error page

app.use(errorController.get404); // page not  found 404 error page

app.use((error, req, res, next) => { // error middleware provided by express
  res.status(500).render('500', {
    pageTitle: 'Error!',
    path: '/500',
    isAuthenticated: req.session.isLoggedIn
  });
});

// connecting the mongodb using the key (MONGODB_URI)

mongoose 
  .connect(MONGODB_URI)
  .then(result => {
    app.listen(3000);
  })
  .catch(err => {
    console.log(err);
  });
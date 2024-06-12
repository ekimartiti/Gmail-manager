const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();

// Replace with your MongoDB Atlas connection string
const mongoURI = '';

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Failed to connect to MongoDB', err));

// Define the schema for emails
const emailSchema = new mongoose.Schema({
    email: String,
    password: String,
    createdAt: Date,
    activeStatus: String,
    soldStatus: String,
    ekStatus: String
});

// Create the model for emails
const Email = mongoose.model('Email', emailSchema);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize session
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Route for login
app.get('/login', (req, res) => {
    res.render('login'); // Create a login.ejs file in your views folder
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'eki' && password === 'eki123:v') {
        req.session.isAuthenticated = true;
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// Route for logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.redirect('/login');
    });
});

// Protected routes
app.get('/', isAuthenticated, async (req, res) => {
    const emails = await Email.find().sort({ createdAt: -1 });
    res.render('index', { emails, searchQuery: '' });
});

app.get('/add', isAuthenticated, (req, res) => {
    res.render('addEmail');
});

app.post('/add', isAuthenticated, async (req, res) => {
    const { email, password, createdAt, activeStatus, soldStatus, ekStatus } = req.body;
    const newEmail = new Email({ email, password, createdAt, activeStatus, soldStatus, ekStatus });
    await newEmail.save();
    res.redirect('/');
});

app.get('/edit/:email', isAuthenticated, async (req, res) => {
    const email = await Email.findOne({ email: req.params.email });
    res.render('editEmail', { email });
});

app.post('/edit/:email', isAuthenticated, async (req, res) => {
    const { activeStatus, soldStatus, ekStatus } = req.body;
    await Email.findOneAndUpdate({ email: req.params.email }, { activeStatus, soldStatus, ekStatus });
    res.redirect('/');
});

app.post('/delete/:email', isAuthenticated, async (req, res) => {
    await Email.findOneAndDelete({ email: req.params.email });
    res.redirect('/');
});

app.get('/search', isAuthenticated, async (req, res) => {
    const { q } = req.query;
    const emails = await Email.find({ email: new RegExp(q, 'i') });
    res.render('index', { emails, searchQuery: q });
});

app.get('/stats', isAuthenticated, async (req, res) => {
    const emails = await Email.find();
    const totalEmails = emails.length;
    const activeEmails = emails.filter(e => e.activeStatus === 'active').length;
    const inactiveEmails = emails.filter(e => e.activeStatus === 'inactive').length;
    const soldEmails = emails.filter(e => e.soldStatus === 'sold').length;
    const notSoldEmails = emails.filter(e => e.soldStatus === 'not sold' && e.activeStatus === 'active').length;

    // Calculate emails by year
    const years = emails.reduce((acc, { createdAt }) => {
        const year = new Date(createdAt).getFullYear();
        acc[year] = (acc[year] || 0) + 1;
        return acc;
    }, {});

    // Prepare data for the chart
    const emailStats = {
        dates: [],
        counts: []
    };

    const emailCountByDate = emails.reduce((acc, email) => {
        const date = new Date(email.createdAt).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date]++;
        return acc;
    }, {});

    for (const [date, count] of Object.entries(emailCountByDate)) {
        emailStats.dates.push(date);
        emailStats.counts.push(count);
    }

    res.render('stats', {
        totalEmails,
        activeEmails,
        inactiveEmails,
        soldEmails,
        notSoldEmails,
        years,
        emailStats,
        searchQuery: '' // pass an empty search query
    });
});

app.get('/stats/:year', isAuthenticated, async (req, res) => {
    const year = parseInt(req.params.year);
    const emails = await Email.find();
    const filteredEmails = emails.filter(e => new Date(e.createdAt).getFullYear() === year);
    const months = filteredEmails.reduce((acc, { createdAt }) => {
        const month = new Date(createdAt).getMonth() + 1;
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    res.render('yearStats', { year, months });
});

app.get('/stats/:year/:month', isAuthenticated, async (req, res) => {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const emails = await Email.find({
        createdAt: {
            $gte: new Date(year, month - 1, 1),
            $lt: new Date(year, month, 1)
        }
    }).sort({ createdAt: -1 }); // Sort in descending order by createdAt

    res.render('monthStats', { year, month, emails });
});

app.get('/status/:status', isAuthenticated, async (req, res) => {
    const { status } = req.params;
    const emails = await Email.find({ soldStatus: status });
    res.render('index', { emails, searchQuery: '' });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

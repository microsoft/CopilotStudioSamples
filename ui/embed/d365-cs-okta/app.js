const express = require("express");
const app = express();
const path = require('path');

app.use(express.json());

const publicRouter = require('./routes/publickey');
const privateRouter = require('./routes/privatekey');
const privateRouterConst = require('./routes/constants');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use('/publickey', publicRouter);
app.use('/privatekey', privateRouter);
app.use('/constants', privateRouterConst);

app.get("/", (req, res) => {
    //res.send("Hello, World");
    res.sendFile(path.join(__dirname, '/views/chatwidget.html'));
});

app.get("/signout", (req, res) => {
    //res.send("Hello, World");
    res.sendFile(path.join(__dirname, '/views/signout.html'));
});

app.listen(process.env.PORT || 5000, () => {
    console.log("Server is running on port " + (process.env.PORT || 5000));
});
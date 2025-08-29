var jwt = require('jsonwebtoken');
var fs = require('fs');
var express = require('express');
var router = express.Router();
require("dotenv").config();

/* GET home page. */
router.get('/', function(req, res){
    var appconstants  = ''
    res.charset = 'utf-8'
    res.set({
        'content-type': 'text/plain'
    }).send(appconstants);
});

module.exports = router;
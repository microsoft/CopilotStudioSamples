var jwt = require('jsonwebtoken');
var fs = require('fs');
var express = require('express');
var router = express.Router();
require("dotenv").config();

/* GET home page. */
router.get('/', function(req, res){
    const appconstants = {
    botTokenURL: process.env.COPILOT_BOT_TOKEN_URL,
    defaultdomain: process.env.AZURE_DEFAULT_DOMAIN,
    clientId: process.env.OKTA_CLIENT_ID,
    baseUrl: process.env.OKTA_ORG_URL
    }
    const jsonappconstants = JSON.stringify(appconstants);
    res.charset = 'utf-8'
    res.set({
        'content-type': 'application/json'
    }).send(jsonappconstants);
});

module.exports = router;
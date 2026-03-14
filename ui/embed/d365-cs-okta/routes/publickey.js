var fs = require('fs');
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res){
    var publicKEY  = fs.readFileSync('./keys/public.key', 'utf8');


    res.charset = 'utf-8'
    res.set({
        'content-type': 'text/plain'
    }).send(publicKEY);
});

module.exports = router;
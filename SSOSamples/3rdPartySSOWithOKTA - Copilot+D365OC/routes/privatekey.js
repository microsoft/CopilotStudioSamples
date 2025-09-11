var jwt = require('jsonwebtoken');
var fs = require('fs');
var express = require('express');
var router = express.Router();
require("dotenv").config();

/* GET home page. */
router.get('/', async function(req, res){
  
  try {
    // var privateKEY  = fs.readFileSync('./keys/private.key', 'utf8');
    const secondsSinceEpoch = Math.round(Date.now()/ 1000);
    const oneHour = 60*60;

    var signOptions = {
      algorithm: 	"RS256"
    };
    
    const authHeaderToken = req.headers.authorization.split(' ')[1];
    const authorizationServerId = process.env.OKTA_AUTHORIZATION_SERVER;
    const yourOktaDomain = process.env.OKTA_ORG_URL;
    const yourOktaClientID = process.env.OKTA_CLIENT_ID;
    const privateKEY = process.env.PRIVATE_KEY.replace(/\\n/g,"\n");

    // console.log("This is the private key:", privateKEY);
    // Get the payload from Okta based on the Okta token.
    console.log("This is the url:", `${yourOktaDomain}/oauth2/${authorizationServerId}/v1/introspect?token=${authHeaderToken}&client_id=${yourOktaClientID}`);
    
    const resp = await fetch(
      `${yourOktaDomain}/oauth2/${authorizationServerId}/v1/introspect?token=${authHeaderToken}&client_id=${yourOktaClientID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const omnichannelResponseBody = await resp.json();
    console.log("Response from introspection:", omnichannelResponseBody);

    var jwtPayloadSample = {
        "sub": "66cb446f-5e43-ea11-a812-000d3a24c087", //contactid in Dynamics
        "preferred_username": omnichannelResponseBody.username,
        "phone_number": "",
        "given_name": "",
        "family_name": "",
        "email": omnichannelResponseBody.username,
        "iat": omnichannelResponseBody.iat, // secondsSinceEpoch,
        "exp": omnichannelResponseBody.exp, // secondsSinceEpoch + oneHour,
        "iss": omnichannelResponseBody.iss
    };
    console.log("This is the sample payload to Omnichannel:", jwtPayloadSample);

    var token = jwt.sign(JSON.stringify(jwtPayloadSample), privateKEY, signOptions);

    // console.log("This is the signed token:", token);

    res.charset = 'utf-8'
    res.set({
        'content-type': 'application/jwt'
    }).send(token);

  } catch (error) {
            // Handle error if needed
            console.error("Error occurred while setting token:", error);
        }
  });

module.exports = router;
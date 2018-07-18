/*
* Helpers methods
*
*/

//Dependencies
var crypto = require('crypto');
var config = require('./config')
var https = require('https');
var querystring = require('querystring');

//Container for helpers
var helpers = {};

//Create a SHA256 hash
helpers.hash = (str) =>{
  if(typeof(str) == 'string' && str.trim().length > 0){
    var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  }else{
    return false;
  }
};

//Parse a JSON string to an object in all cases without throwing
helpers.parseJsonToObject = (str)=>{
  try{
    var obj = JSON.parse(str);
    return obj;
  }catch(e){
    console.log(e);
    return {};
  }
};

//Create a string of random alphanumeric characters of a given length
helpers.createRandomString = (strLength)=>{
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
  if(strLength){
    //Define all the possible characters to use
    var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    //Start the final string
    var str = '';

    for(var i = 1; i<=strLength; i++){
      //get a random character from the possibleCharacters string
      var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      //Append the character to the final string
      str += randomCharacter;
    }

    //Return final str
    return str;
  }else{
    return false;
  }
};

//Send an SMS via Twilio
helpers.sendTwilioSms = (phone, msg, callback) =>{

  //Validate parameters
  phone = typeof(phone) == 'string' && phone.trim().length == 9 ? phone.trim() : false;
  msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;

  if(phone && msg){
    //Config the request payload to send
    var payload = {
      'From' : config.twilio.fromPhone,
      'To' : '+34' + phone,
      'Body' : msg
    };

    //Stringify payload
    var stringPayload = querystring.stringify(payload);

    //Configure the request details
    var requestDetails = {
      'protocol' : 'https:',
      'hostname' : 'api.twilio.com',
      'method' : 'POST',
      'path' : '/2010-04-01/Accounts/' + config.twilio.accountSid+'/Messages.json',
      'auth' : config.twilio.accountSid +':'+config.twilio.authToken,
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length' : Buffer.byteLength(stringPayload)
      }
    };

    //Instantiate request object
    var req = https.request(requestDetails, (res) =>{
      //Grab status of the sent request
      var status = res.statusCode;
      //Callback succesfully if the request went through
      if(status == 200 || status == 201){
        callback(false);
      }else{
        callback('Status code returned ' + status);
      }
    });

    //Bind to the error event so it doesn't get thrown
    req.on('error', (e) =>{
      callback(e);
    });

    //add payload to the request
    req.write(stringPayload);

    //End the request
    req.end();
  }else{
    callback('Given parameters missing or invalid');
  }

};

//Export the module
module.exports = helpers;

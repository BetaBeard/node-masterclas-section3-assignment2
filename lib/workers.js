/*
* Worker related tasks
*
*
*/

//Dependencies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');

//Instatiate workers object
var workers = {};

//Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = () =>{
  //Get all the checks that exists in the system
  _data.list('checks', (err, checks) =>{
    if(!err && checks && checks.length > 0){
      checks.forEach((check) =>{
        //Read in the check data
        _data.read('checks', check, (err, originalCheckData) =>{
            if(!err && originalCheckData){

              //Pass the data to the check validator, let that function continue or log errors
              workers.validateCheckData(originalCheckData);
            }else{
              debug('Error reading one of the checks data');
            }
        });
      });
    }else{
      debug('Error: could not find any checks to process');
    }
  });
};

//Sanitity check the check data
workers.validateCheckData = (originalCheckData) =>{
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20  ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 9  ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) != -1 ? originalCheckData.protocol.trim() : false;
  originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0  ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) != -1 ? originalCheckData.method.trim() : false;
  originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds  % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  //Set the keys that may not be set if the workers have not been seen before
  originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) != -1 ? originalCheckData.state.trim() : 'down';
  originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  //If all the checks pass, pass the data to the next step of the process
  if(originalCheckData.id &&
  originalCheckData.userPhone &&
  originalCheckData.protocol &&
  originalCheckData.url &&
  originalCheckData.method &&
  originalCheckData.successCodes &&
  originalCheckData.timeoutSeconds){
    workers.performCheck(originalCheckData);
  }else{
    debug('Error: one of the checks is not properly formatted. Skipping it.');
  }

};

//Perform the check, send the original check data and the outcome of the check process to the next step
workers.performCheck = (originalCheckData) =>{
  //Prepare the initial check outcome
  var checkOutcome = {
    'error' : false,
    'responseCode' : false
  };

  //Mark that the outcome has not been sent yet
  var outcomeSent = false;

  //Parse the host name and path out of the check data
  var parsedUrl = url.parse(originalCheckData.protocol +'://'+originalCheckData.url, true);
  var hostName = parsedUrl.hostname;
  var path = parsedUrl.path; //Using path and not "pathname" because we want the query string

  //Construct the request
  var requestDetails = {
    'protocol' : originalCheckData.protocol +':',
    'hostname' : hostName,
    'method' : originalCheckData.method.toUpperCase(),
    'path' : path,
    'timeout' : originalCheckData.timeoutSeconds * 1000
  };

  //Instantiate the request object using http or https
  var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
  var req = _moduleToUse.request(requestDetails, (res)=>{
    //Grab status of the sent request
    var status = res.statusCode;

    checkOutcome.responseCode = status;
    if(!outcomeSent){
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //Bind to the error event so it doesn't get thrown
  req.on('error', (e) =>{
    //Update the checkoutcome
    checkOutcome.error = {
      'error': true,
      'value' : e
    };

    if(!outcomeSent){
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //Bind to the timeout
  req.on('timeout', (e) =>{
    //Update the checkoutcome
    checkOutcome.error = {
      'error': true,
      'value' : 'timeout'
    };

    if(!outcomeSent){
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //End the request
  req.end();
};

//process the check outcome, update the check data as needed, trigger an alert
//Special logic for accomodation a check that has never been check before
workers.processCheckOutcome = (originalCheckData, checkOutcome) =>{
  //Decide if the check is considered up or down
  var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) != -1 ? 'up' : 'down';

  //Decide if we are going to send an alert
  var alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

  //Log the outcome
  var timeOfCheck = Date.now();
  workers.log(originalCheckData, checkOutcome,state,alertWarranted, timeOfCheck);

  //Update the check data
  var newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = Date.now();

  //Save the check
  _data.update('checks', newCheckData.id, newCheckData, (err) =>{
    if(!err){
      //Send the alert
      if(alertWarranted){
        workers.alertUserToStatusChange(newCheckData);
      }else{
        debug('Check outcome has not change, no alert needed');
      }
    }else{
      debug('Error trying to save a check state');
    }
  });
};

//Alert the user of a change in their check status
  workers.alertUserToStatusChange = (newCheckData) =>{
    var msg = 'Alert: your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol+'://' +newCheckData.url +' is currently '+ newCheckData.state;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) =>{
      if(!err){
        debug('Success, user was alerted to a status change in their change', msg);
      }else{
        debug('Error, could not send sms alert to the user');
      }
    });
  };

workers.log = (originalCheckData, checkOutcome,state,alertWarranted, timeOfCheck) =>{
  //Form the log data
  var logData = {
    'check' : originalCheckData,
    'outcome' : checkOutcome,
    'state' : state,
    'alert' : alertWarranted,
    'time' : timeOfCheck
  };

  //convert data to string
  var logString = JSON.stringify(logData);

  //Determine the log of the file
  var logFileName = originalCheckData.id;

  //Append the log string to a file
  _logs.append(logFileName, logString, (err) =>{
    if(!err){
      debug("Loggin to file succeeded");
    }else{
      debug("Loggin to file failed");
    }
  });
};

//Timer to execute the workers process one per minute
workers.loop = ()=>{
  setInterval(()=>{
    workers.gatherAllChecks();
  }, 1000 * 60);
};

//Rotate (compress) log files
workers.rotateLogs = () =>{
  //List all non compressed log file
  _logs.list(false, (err, logs) =>{
    if(!err && logs && logs.length > 0){
      logs.forEach((logName) => {
        //Compress the data to a different file
        var logId = logName.replace('.log', '');
        var newFileId = logId + ' - ' + Date.now();
        _logs.compress(logId, newFileId, (err) =>{
          if(!err){
            //Truncate the log
            _logs.truncate(logId, (err) =>{
              if(!err){
                debug('Success truncating log file');
              }else{
                debug('Error truncating log file');
              }
            });
          }else{
            debug('Error compressing one of the log files', err);
          }
        });
      });
    }else{
      debug('Could not find any logs to rotate');
    }
  });
};

//Compress logs once per day
workers.logRotationLoop = ()=>{
  setInterval(()=>{
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24);
};

//Init script
workers.init = ()=>{

  //Send to console in yellow
  console.log('\x1b[33m%s\x1b[0m','Background workers are running');

  //Execute all the checks
  workers.gatherAllChecks();

  //Call the loop so checks will execute later on
  workers.loop();

  //Compress all the logs immeditaly
  workers.rotateLogs();

  //Call the compression loop so logs will be compressed later on
  workers.logRotationLoop();
};

//Export the module
module.exports = workers;

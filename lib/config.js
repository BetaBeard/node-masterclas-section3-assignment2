/*
* Create and export config variables
*
*/

//Container
var environments = {};

//Staging env (default)
environments.staging = {
  'httpPort' : 3000,
  'httpsPort' : 3001,
  'envName' : 'staging',
  'hashingSecret' : 'thisIsASecret',
  'maxChecks' : 5,
  'twilio' : {
     'accountSid' : 'ACb32d411ad7fe886aac54c665d25e5c5d',
     'authToken' : '9455e3eb3109edc12e3d8c92768f7a67',
     'fromPhone' : '+15005550006'
   }
};


//Prod environment
environments.production = {
  'httpPort' : 5000,
  'httpsPort' : 5001,
  'envName' : 'production',
  'hashingSecret' : 'thisIsAlsoASecret',
  'maxChecks' : 5,
  'twilio' : {
    'accountSid' : '',
    'authToken' : '',
    'fromPhone' : ''
  }
};


//Determine which env was passed through command-line
var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase():'';

//Check that the env provided is valid, if not default to Staging
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

//Export module
module.exports = environmentToExport;

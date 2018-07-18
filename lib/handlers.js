/*
*Request handlers
*
*/

//Dependencies
var _data = require('./data')
var helpers = require('./helpers');
var config = require('./config');
//Define handlers
var handlers = {};

//Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

//Ping handler
handlers.ping = (data, callback) => {
  callback(200);
};

//Users handlers
handlers.users = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) != -1){
    handlers._users[data.method](data, callback);
  }else{
    callback(405);
  }
};

//Container for users sub methods
handlers._users = {};

//Users post
//Required data: name, email, address, password, tosAgreement
//Optional data: none
handlers._users.post = (data, callback)=>{
  //Define an email regula expression
  var emailRegex = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

  //Check that required fields are there
  var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && emailRegex.test(data.payload.email.trim()) ? data.payload.email.trim() : false;
  var address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

  if(name && email && address && password && tosAgreement){
    //Ensure that the user doesn't already exists
    _data.read('users', email, (err, data)=>{
      if(err){
        //Hash the password
        var hashedPassword = helpers.hash(password);

        if(hashedPassword){
          //Create user object
          var userObject = {
            'name' : name,
            'email' : email,
            'address' : address,
            'hashedPassword' : hashedPassword,
            'tosAgreement' : tosAgreement
          };

          //Store the user
          _data.create('users', email, userObject, (err)=>{
            if(!err){
              callback(200);
            }else{
              console.log(err);
              callback(500, {'Error' : 'Could not create the new user'});
            }
          });
        }else{
          callback(500, {'Error' : 'Could not hash the users password'});
        }
      }else{
        //User already exists
        callback(400, {'Error' : 'User with that email already exists'});
      }
    });
  }else{
    callback(404, {'Error' : 'Missing required fields'});
  }
};

//Users get
//Required data: phone
//Optional data: none
handlers._users.get = (data, callback)=>{
  //Chech the phone number is valid
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && emailRegex.test(data.payload.email.trim()) ? data.payload.email.trim() : false;
  if(email){

    //Get the token from the headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    handlers._tokens.verifyToken(token, email, (tokenIsValid) =>{
      if(tokenIsValid){
        _data.read('users', email, (err, data) => {
          if(!err && data){
            //Remove hash password
            delete data.hashedPassword;
            callback(200, data);
          }else{
            callback(404);
          }
        });
      }else{
        callback(403, {'Error' : 'Missing required token in header or token is invalid'});
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field'});
  }
};

//Users put
//Required data: email
//Optional data: name, address, password (at least one must be specified)
handlers._users.put = (data, callback)=>{
  //Check require field
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && emailRegex.test(data.payload.email.trim()) ? data.payload.email.trim() : false;

  //Check optional fields
  var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
  var address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if(email){
    if(name || address || password){

      //Get the token from the headers
      var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      handlers._tokens.verifyToken(token, phone, (tokenIsValid) =>{
        if(tokenIsValid){
          _data.read('users', email, (err, data) => {
            if(!err && data){
              //update the fields
              var userData = {};
              if(name){
                userData.name = name;
              }

              if(address){
                userData.address = address;
              }

              if(password){
                userData.hashedPassword = helpers.hash(password);
              }

              _data.update('users', email, userData, (err) => {
                if(!err){
                  callback(200);
                }else{
                  console.log(err);
                  callback(500, {'Error' : 'Could not update the user'});
                }
              });

            }else{
              callback(400, {'Error' : 'The specified user does not exist'});
            }
          });
        }else{
          callback(403, {'Error' : 'Missing required token in header or token is invalid'});
        }
      });

    }else{
      callback(400, {'Error' : 'Missing fields to update'})
    }
  }else{
    callback(400, {'Error' : 'Missing required field'})
  }
};

//Users delete
//Required data: phone
handlers._users.delete = (data, callback)=>{
  //Chech the phone number is valid
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && emailRegex.test(data.payload.email.trim()) ? data.payload.email.trim() : false;
  if(email){
    //Get the token from the headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    handlers._tokens.verifyToken(token, email, (tokenIsValid) =>{
      if(tokenIsValid){
        _data.read('users', email, (err, userData) => {
          if(!err && data){
            //Remove hash password
            _data.delete('users', email, (err) =>{
              if(!err){
                //Delete each check associated with the user
                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                var checksToDelete = userChecks.length;
                if(checksToDelete > 0){
                  var checksDeleted = 0;
                  var deletionErrors = false;
                  //loop through the checks
                  userChecks.forEach((checkId) =>{
                    //delete the check
                    _data.delete('checks', checkId, (err) =>{
                      if(err){
                        deletionErrors = true;
                      }
                      checksDeleted++;
                      if(checksDeleted == checksToDelete){
                        if(!deletionErrors){
                          callback(200);
                        }else{
                          callback(500, {'Error' : 'Errors encountered while deleting users checks. All checks may not have been deleted from the system'});
                        }
                      }
                    });
                  });
                }else{
                  callback(200);
                }
              }else{
                callback(500, {'Error' : 'Could not delete the user'});
              }
            });
          }else{
            callback(400, {'Error': 'Could not find the specified user'});
          }
        });
      }else{
        callback(403, {'Error' : 'Missing required token in header or token is invalid'});
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field'});
  }
};

handlers.tokens = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) != -1){
    handlers._tokens[data.method](data, callback);
  }else{
    callback(405);
  }
};

//Container for tokens methods
handlers._tokens = {};

//Tokens post
//Required data: email, password
//Optional data:
handlers._tokens.post = (data, callback) =>{
  var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && emailRegex.test(data.payload.email.trim()) ? data.payload.email.trim() : false;
  var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if(email && password){
    //Lookup the user
    _data.read('users', email, (err, data) => {
      if(!err && data){
        //Hash the sent password and compare to the stored one
        var hashedPassword = helpers.hash(password);
        if(hashedPassword == data.hashedPassword){
          //Create a new token with a random name. Set expiration date 1 hour in the future
          var tokenId = helpers.createRandomString(20);
          var expires = Date.now() + 1000 * 60 * 60;
          var tokenObject = {
            'email' : email,
            'id' : tokenId,
            'expires' : expires
          };

          //Store the token
          _data.create('tokens', tokenId, tokenObject, (err)=>{
            if(!err){
              callback(200, tokenObject);
            }else{
              callback(500, {'Error' : 'Could not create the new token'});
            }
          });
        }else{
          callback(400, {'Error' : 'Password did not match the specified user'});
        }
      }else{
        callback(400, {'Error' : 'Could not find the specified user'});
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required fields'});
  }
};

//Tokens get
//Required data: id
//Optional data: none
handlers._tokens.get = (data, callback) =>{
  //Check valid ID
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    _data.read('tokens', id, (err, tokenData) => {
      if(!err && tokenData){
        callback(200, tokenData);
      }else{
        callback(404);
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field, or field invalid'});
  }
};

//Tokens put
//Required fields: id, extend
//Optional data: none
handlers._tokens.put = (data, callback) =>{
  var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend? data.payload.extend : false;

  if(id && extend){
    //Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
      if(!err && tokenData){
        //Check that token is not expired
        if(tokenData.expires > Date.now()){
          tokenData.expires = Date.now() + 1000 * 60 * 60;
          _data.update('tokens', id, tokenData, (err) => {
            if(!err){
              callback(200, tokenData);
            }else{
              callback(500, {'Error' : 'Could not update the token expiration'});
            }
          });
        }else{
          callback(400, {'Error' : 'The token has already expired, it can not be extended'});
        }
      }else{
        callback(404);
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field, or field invalid'});
  }
};

//Tokens delete
//Required data: id
//Optional data: none
handlers._tokens.delete = (data, callback) =>{
  //Chech the phone number is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    _data.read('tokens', id, (err, data) => {
      if(!err && data){
        //Remove hash password
        _data.delete('tokens', id, (err) =>{
          if(!err){
            callback(200);
          }else{
            callback(500, {'Error' : 'Could not delete the token'});
          }
        });
      }else{
        callback(400, {'Error': 'Could not find the specified token'});
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field'});
  }
};

//Verify if the given token id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback)=>{
  //Lookup token
  _data.read('tokens', id, (err, tokenData) => {
    if(!err && data){
      //Check token is for the given user and is not expired
      if(tokenData.phone == phone && tokenData.expires > Date.now()){
        callback(true);
      }else{
        callback(false);
      }
    }else{
      callback(false);
    }
  });
};


handlers.checks = (data, callback) => {
  var acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) != -1){
    handlers._checks[data.method](data, callback);
  }else{
    callback(405);
  }
};

//Container for checks methods
handlers._checks = {};

//Checks post
//Required data: protocol, url, method, successCodes, timeoutSeconds
//Optional data: none
handlers._checks.post = (data, callback) =>{
  //Validate inputs
  var protocol = typeof(data.payload.protocol) == 'string' && ['https' , 'http'].indexOf(data.payload.protocol.trim()) > -1 ? data.payload.protocol.trim() : false;
  var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  var method = typeof(data.payload.method) == 'string' && ['post' , 'get', 'put', 'delete'].indexOf(data.payload.method.trim()) > -1 ? data.payload.method.trim() : false;
  var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds  % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  if(protocol && url && method && successCodes && timeoutSeconds){
    //get the token from the headers
    var token = typeof(data.headers.token.trim()) == 'string' ? data.headers.token.trim() : false;

    //Lookup the user by reading the token
    _data.read('tokens', token, (err, tokenData) => {
      if(!err && tokenData){
        var userPhone = tokenData.phone;
        _data.read('users', userPhone, (err, userData) => {
          if(!err && userData){
            var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
            //Verify there are less than the max checks per user
            if(userChecks.length < config.maxChecks){
              //Create a random id for the check
              var checkId = helpers.createRandomString(20);

              //Create the check object and include the users phone
              var checkObject = {
                'id' : checkId,
                'userPhone' : userPhone,
                'protocol' : protocol,
                'url' : url,
                'method' : method,
                'successCodes' : successCodes,
                'timeoutSeconds': timeoutSeconds
              };

              //Save the check
              _data.create('checks', checkId, checkObject, (err) =>{
                if(!err){
                  //Add the check id to the users object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  //Save the new user data
                  _data.update('users', userPhone, userData, (err) =>{
                    if(!err){
                      //Return the data of the new check
                      callback(200, checkObject);
                    }else{
                      callback(500, {'Error' : 'Could not update the new check to the user'});
                    }
                  });
                }else{
                  callback(500, {'Error' : 'Could not create the new check'});
                }
              });
            }else{
              callback(400, {'Error' : 'Maximun checks limit reached (' + config.maxChecks +')'});
            }
          }else{
            callback(403);
          }
        });
      }else{
        callback(403);
      }
    });

  }else{
    callback(400, {'Error' : 'Missing required fields or inputs are invalid'});
  }
};

//Checks get
//Required data: id
//Optional data: none
handlers._checks.get = (data, callback) => {
  //Validate inputs
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){

    //Lookup the check
    _data.read('checks', id, (err, checkData) =>{
      if(!err && checkData){
        //Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) =>{
          if(tokenIsValid){
            //return check data
            callback(200, checkData);
          }else{
            callback(403, {'Error' : 'Missing required token in header or token is invalid'});
          }
        });
      }else{
        callback(404);
      }
    });
  }else{
    callback(400, {'Error' : 'Missing required field'});
  }
};
//Checks put
//Required data: id
//Optional data: protocol, url, method, successCodes, timeoutSeconds (at least one is needed)
handlers._checks.put = (data, callback) =>{
  //Validate inputs
  var protocol = typeof(data.payload.protocol) == 'string' && ['https' , 'http'].indexOf(data.payload.protocol.trim()) > -1 ? data.payload.protocol.trim() : false;
  var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  var method = typeof(data.payload.method) == 'string' && ['post' , 'get', 'put', 'delete'].indexOf(data.payload.method.trim()) > -1 ? data.payload.method.trim() : false;
  var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds  % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    //Check there is at least one field to update
    if(protocol || url || method || successCodes || timeoutSeconds){
      //Lookup the check
      _data.read('checks', id, (err, checkData) =>{
        if(!err && checkData){
          //Get the token from the headers
          var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

          handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) =>{
            if(tokenIsValid){
              if(protocol){
                checkData.protocol = protocol;
              }

              if(url){
                checkData.url = url;
              }

              if(method){
                checkData.method = method;
              }

              if(successCodes){
                checkData.successCodes = successCodes;
              }

              if(timeoutSeconds){
                checkData.timeoutSeconds = timeoutSeconds;
              }

              _data.update('checks', id, checkData, (err) => {
                if(!err){
                  callback(200);
                }else{
                  callback(500, {'Error' : 'Check could not be updated'});
                }
              });
            }else{
              callback(403, {'Error' : 'Missing required token in header or token is invalid'});
            }
          });
        }else{
          callback(404);
        }
      });
    }else{
      callback(400, {'Error' : 'No fields to update'});
    }
  }else{
    callback(400, {'Error' : 'Missing required field'});
  }
};
//Checks delete
//Required data: id
//Optional data: none
handlers._checks.delete = (data, callback) =>{
  //Validate inputs
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
    //Lookup the check
    _data.read('checks', id, (err, checkData) =>{
      if(!err && checkData){
        //Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) =>{
          if(tokenIsValid){
            //Delete the check data
            _data.delete('checks', id, (err) =>{
              if(!err){
                callback(200);
              }else{
                callback(500, {'Error' : 'Could not delete the check'});
              }
            });

            //Lookup user and delete the reference to the check
            _data.read('users', phone, (err, userData) => {
              if(!err && userData){
                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                //Remove the deleted check from the checks array
                var checkPosition = userChecks.indexOf(id);
                if(checkPosition > -1){
                  userChecks.splice(checkPosition, 1);
                  _data.update('users', checkData.userPhone, userData, (err) =>{
                    if(!err){
                      callback(200);
                    }else{
                      callback(500, {'Error' : 'Could not remove the check from the user'});
                    }
                  });
                }else{
                  callback(500, {'Error': 'The check is not in the user check list'});
                }

              }else{
                callback(400, {'Error': 'Could not find the specified user'});
              }
            });
          }else{
            callback(403, {'Error' : 'Missing required token in header or token is invalid'});
          }
        });
      }else{
        callback(400, {'Error' : 'Could not find the check'});
      }
    });

  }else{
    callback(400, {'Error' : 'Missing required fields'});
  }



};
//Export handlers
module.exports = handlers;

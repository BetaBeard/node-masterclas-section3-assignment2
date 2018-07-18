/*
* Server related tasks
*
*
*/

//Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./handlers')
var helpers = require('./helpers')
var path = require('path');
var util = require('util');
var debug = util.debuglog('server');

//Instantiate server module object
var server = {};

//Instantiate the HTTP Server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res);
});


//Configuration for the HTTPS Server
server.httpsServerOptions = {
    'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
};

//Instatiate the HTTPS Server
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
  server.unifiedServer(req, res);
});



//Initiate the server
server.unifiedServer = (req, res) =>{

    //Get URL and parse it
    var parsedURL = url.parse(req.url, true);

    //Get the path
    var path = parsedURL.pathname;
    var trimmedPath = path.replace(/^\/+|\/+$/g, '');

    //Get the query string as an object
    var queryStringObject = parsedURL.query;

    //Get the HTTP Method
    var method = req.method.toLowerCase();

    //Get headers as an object
    var headers = req.headers;

    // Get the payload
    var decoder = new StringDecoder('utf-8');
    var buffer = '';

    req.on('data', (data) =>{
      buffer += decoder.write(data);
    });

    req.on('end', () =>{
      buffer += decoder.end();

      //Choose handler to use
      var choosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;
      //Construct data object for handlers
      var data = {
        'trimmedPath' : trimmedPath,
        'queryStringObject': queryStringObject,
        'method' : method,
        'headers' : headers,
        'payload' : helpers.parseJsonToObject(buffer)
      };

      //Route the request to the handler
      choosenHandler(data, (statusCode, payload) =>{
        //Use the status code called back by the handler or default to 200
        statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

        //Use the payload returned or default to {}
        payload = typeof(payload) == 'object' ? payload : {};

        //Convert payload to a string
        var payloadString = JSON.stringify(payload);

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(statusCode);
        res.end(payloadString);

        //if the response is 200 print green, otherwise print red
        if(statusCode == 200){
          debug('\x1b[32m%s\x1b[0m',method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
        }else{
          debug('\x1b[31m%s\x1b[0m',method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
        }
      });
    });
};

//Request router
server.router = {
  'ping' : handlers.ping,
  'users' : handlers.users,
  'tokens' : handlers.tokens,
  'checks' : handlers.checks
};

server.init = ()=>{
  //Start the server and listen on the env port
  server.httpServer.listen(config.httpPort, () =>{
    console.log('\x1b[36m%s\x1b[0m',"Server listening on HTTP " + config.httpPort);
  });

  //Start the server and listen on the env port
  server.httpsServer.listen(config.httpsPort, () =>{
    console.log('\x1b[35m%s\x1b[0m',"Server listening on HTTPS " + config.httpsPort );
  });

};

//Export the server
module.exports = server;

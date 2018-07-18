/*
* Logs related tasks
*
*
*/

//Dependencies
var fs = require('fs');
var _data = require('./data');
var path = require('path');
var zlib = require('zlib');

//Container for the module
var lib = {};

lib.baseDir = path.join(__dirname, '/../.logs/');

//Append a string to the file. Create the file if it does not exist
lib.append = (fileName, str, callback)=>{
  //Open the file for appending
  fs.open(lib.baseDir +fileName+'.log', 'a', (err, fileDescriptor)=>{
    if(!err && fileDescriptor){
      //Append to the file and close it
      fs.appendFile(fileDescriptor,str+'\n', (err) =>{
        if(!err){
          fs.close(fileDescriptor, (err) =>{
            if(!err){
              callback(false);
            }else{
              callback('Error closing file that was being appended');
            }
          });
        }else{
          callbak('Error appending to file');
        }
      });
    }else{
      callback('Could not open file for appending');
    }
  });
};

//List all the logs and optionally include the compress logs
lib.list = (includeCompressedLogs, callback)=>{
  fs.readdir(lib.baseDir, (err, data) =>{
    if(!err && data && data.length > 0){
      var trimmedFileNames = [];
      data.forEach(fileName => {
        //Add the .log files
        if(fileName.indexOf('.log') != -1){
          trimmedFileNames.push(fileName.replace('.log', ''));
        }

        //Add on the .gz files to the array
        if(fileName.indexOf('.gz.b64') != -1 && includeCompressedLogs){
          trimmedFileNames.push(fileName.replace('.gz.b64', ''));
        }
      });
      callback(false, trimmedFileNames);
    }else{
      callback(err, data);
    }
  });
};

//Compress the contents of one .log file into a .gz.b64
lib.compress = (logId, newFileId, callback) =>{
  var sourceFile = logId+'.log';
  var destinationFile = newFileId +'.gz.b64';

  //Read the source file
  fs.readFile(lib.baseDir +sourceFile, 'utf8', (err, inputString) => {
    if(!err && inputString){
      //Compress the data using gzip
      zlib.gzip(inputString, (err, buffer) =>{
        if(!err && buffer){
          //Send the compress data to the destinationFile
          fs.open(lib.baseDir +destinationFile, 'wx', (err, fileDescriptor)=>{
            if(!err && fileDescriptor){
              fs.writeFile(fileDescriptor, buffer.toString('base64'), (err) =>{
                if(!err){
                  //Close file
                  fs.close(fileDescriptor, (err) =>{
                    if(!err){
                      callback(false);
                    }else{
                      callback(err);
                    }
                  });
                }else{
                  callback(err);
                }
              });
            }else{
              callback(err);
            }
          });
        }else{
          callback(err);
        }
      });
    }else{
      callback(err);
    }
  });
};

//Decompress contents of a .gz.b64 file into a string
lib.decompress = (fileId, callback) =>{
  var fileName = fileId+'.gz.b64';
  fs.readFile(baseDir + fileName, 'utf8',(err, str) =>{
    if(!err && str){
      //Decompress file
      var inputBuffer = Buffer.from(str, 'base64');
      zlib.unzip(inputBuffer, (err, outputBuffer) =>{
        if(!err && outputBuffer){
          var str = outputBuffer.toString();
          callback(false, str);
        }else{
          callback(err);
        }
      });
    }else{
      callback(err);
    }
  });
};

//Truncating a log file
lib.truncate = (logId, callback) =>{
  fs.truncate(lib.baseDir + logId +'.log', 0, (err) =>{
    if(!err){
      callback(false);
    }else{
      callback(err);
    }
  });
};

//export the module
module.exports = lib;

/*
* library for storing and editing data
*
*/

//Dependencies
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');
//Container for the module (to be exported)
var lib = {};

//Base directory of the data folder
lib.baseDir = path.join(__dirname, '/../.data/');

//Write data to a file
lib.create = (dir, file, data, callback)=>{

  //Try to open the file to write
  fs.open(lib.baseDir + dir + '/' + file + '.json', 'wx', (err, fileDescriptor)=>{
    if(!err && fileDescriptor){
      //Convert data to a string
      var stringData = JSON.stringify(data);
      //Write to file and close it
      fs.writeFile(fileDescriptor, stringData, (err)=>{
        if(!err){
          fs.close(fileDescriptor, (err)=>{
              if(!err){
                callback(false);
              }else{
                callback('Error closing file')
              }
            });
        }else{
          callback('Error writing to new file')
        }
      });
    }else{
      callback('Could not create the file, it may already exist');
    }
  });
};

//Read from a file
lib.read = (dir, file, callback) => {
  fs.readFile(lib.baseDir + dir + '/' + file + '.json', 'utf8', (err, data)=>{
    if(!err && data){
      var parsedData = helpers.parseJsonToObject(data);
      callback(false, parsedData);
    }else{
      callback(err, data);
    }
  });
};

//Update data inside a file
lib.update = (dir, file, data, callback) =>{
  //open the file for writting
  fs.open(lib.baseDir + dir + '/' + file + '.json', 'r+', (err, fileDescriptor)=>{
    if(!err && fileDescriptor){
        var stringData = JSON.stringify(data);
        //Truncate file
        fs.truncate(fileDescriptor, (err) => {
          if(!err){
            //Write file and close it
            fs.writeFile(fileDescriptor, stringData, (err) => {
              if(!err){
                fs.close(fileDescriptor, (err)=>{
                  if(!err){
                    callback(false);
                  }else{
                    callback('Error closing file');
                  }
                });
              }else{
                callback('Error writing to existing file');
              }
            });
          }else{
            callback('Error truncating file');
          }
        });
    }else{
      callback('Could not open the file for update, it may not exist yet');
    }
  });
};

//Delete a file
lib.delete = (dir, file, callback) =>{
  //Unlink the file
  fs.unlink(lib.baseDir + dir + '/' + file + '.json',(err) => {
    if(!err){
      callback(false);
    }else{
      callback('Error unlinking file');
    }
  });
};

//List all the items in a directory
lib.list = (dir, callback) =>{
  fs.readdir(lib.baseDir +dir +'/', (err, data) =>{
    if(!err && data && data.length >0){
      var trimmedFileNames = [];
      data.forEach((fileName)=>{
        trimmedFileNames.push(fileName.replace('.json', ''));
      });
      callback(false, trimmedFileNames);
    }else{
      callback(err, data);
    }
  });
};
//Export the module
module.exports = lib;

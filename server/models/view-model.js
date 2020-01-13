var config = require("../config");
var Promise = require('promise');
var utils = require("../utils/utils");
var dblogger = require("../utils/dblogger.js");
var _ = require('underscore');
//incomaptibel win32var jsondir = require('jsondir');
var cacheFactory = require('./cache-factory');
var fs = require('fs');

// use a cache with 10 min expiration so we dont have to read from the disk
var _viewCache = cacheFactory.createCache({
    stdTTL: 600
});

function viewModel() {};
module.exports = viewModel;
viewModel.flushAll = function () {
    _viewCache.flushAll();
}
viewModel.get = function (filenameOrObject, folderName) {

    var promise = new Promise(function (resolve, reject) {
        if (_.isObject(filenameOrObject)) {
            return resolve(JSON.stringify(filenameOrObject));
        }
        //Check if the view content supplied already
        // TODO: better check
        if (filenameOrObject.length > 50) {
            return resolve(filenameOrObject);
        }
        var file = folderName + '/views/' + filenameOrObject;
        if (!file.endsWith('.json')) {
            file += '.json';
        }

        value = _viewCache.get(file, true);
        if (value) {
            return resolve(value);
        } else {
            // ENOTFOUND: Key not found
            fs.readFile(file, function (err, data) {
                if (err) {
                    // if no such file, treat it as code
                    if (err.code == "ENOENT") {
                        var warn1 = 'error when trying to use as file: ' + file + ' and folder ' + folderName + ': ' + err;
                        dblogger.warn(warn1);
                        // use as code
                        data = filenameOrObject;
                    } else {
                        var error = 'error when reading file: ' + file + ' and folder ' + folderName + ': ' + err.message;
                        dblogger.error(error);
                        reject(error);
                    }


                }

                data = data.toString();
                _viewCache.set(file, data);
                resolve(data);

            });
        }

    });

    return promise;
}

// viewModel.getAll = function(userId,fsmId) {

//     var promise = new Promise(function(resolve,reject) {
// 		var path = ('code/'+userId+'/fsms/'+fsmId+'/views');

// 		jsondir.dir2json(path, function(err, results) {
// 			if (err) reject(err);
// 			else resolve(results);
// 		});

//     });

//     return promise;
// }
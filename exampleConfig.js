/////////////////////////////////////////////////////////////////////////////////////////////////
//   This is an example config file                                                            //
//   To use this file, change the database connection settings and rename it to config.js      //
//   This example uses mysql, but you can use any waterline adapter and it should work fine    //
//   Note: If you do change the database type, you'll have to change the manual queries in     //
//   the create functions to match the syntax of the new database                              //
/////////////////////////////////////////////////////////////////////////////////////////////////

var mysql = require('sails-mysql');

var config = {
    adapters: {
        'default': mysql,
        mysql: mysql
    },
    connections: {
        mySqlAdapter: {
            adapter: 'mysql',
            host: 'localhost',
            database: 'tibiaapi', //Note: Since we actually hard-code the insertions, this database name will need to stay the same, unless you find and replace in the app.js file
            user: 'exampleUser',
            password: 'password12'
        }
    },
    defaults: {
        migrate: 'alter'
    },
    recordsAtATime: 1000 //Not used in the actual waterline config object, but used in app.js to determine how many rows it should insert in one query.
};

exports.config = config;
/////////////////////////////////////////////////////////////////////////////////////////////////
//   This is an example config file                                                            //
//   To use this file, change the database connection settings and rename it to config.js      //
//   This example uses mysql, but you can use any waterline adapter and it should work fine    //
/////////////////////////////////////////////////////////////////////////////////////////////////

var	mysql = require('sails-mysql');

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
    }
};

exports.config = config;
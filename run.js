/*jslint node: true */
'use strict';
const path = require('path');
require('dotenv').config({ path: path.dirname(process.mainModule.paths[0]) + '/.env' });
const db_import = require('./db_import.js');
const webserver = require('./webserver.js');
const forwarder = require('./forwarder.js');
const buyer = require('./buyer.js');



async function start() {
	await db_import.initDB();
	await forwarder.start();
	await buyer.start();
	webserver.start();
}


process.on('unhandledRejection', async up => {
	console.log('unhandledRejection event', up);
	process.exit(1);
});

start();

/*jslint node: true */
"use strict";
const fetch = require('node-fetch');
//var SocksProxyAgent = require('socks-proxy-agent');

const URL = 'https://blockchain.info';

//const proxy = 'socks://127.0.0.1:9150';
//const agent = new SocksProxyAgent(proxy);

const request = (endpoint, options) => {
	return fetch(`${URL}${endpoint}`, {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	//	agent,
		...options
	})
}

const getAddressHistory = async (address) => {
	const response = await request(`/rawaddr/${address}`)

//	console.error(JSON.stringify(response, null, 2))
//	console.error('ok', response.ok)

	if (!response.ok) {
		const error = await response.text()
		console.error('-- error', error)
		throw new Error(error)
	}

	const data = await response.json()
	return data
}

async function test() {
	const history = await getAddressHistory('1FEpdh87NffKaHaFiADUn1XLKYphG2oxmV');
	console.log(history);
}
//test();

async function testRateLimit() {
	async function wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	for (let i = 0; i < 10; i++){
		console.log(i);
		await test();
		await wait(10000);
	}
}
//testRateLimit();

exports.getAddressHistory = getAddressHistory;

/*jslint node: true */
"use strict";
const fetch = require('node-fetch');

const URL = 'https://blockchain.info';


const request = (endpoint, options) => {
	return fetch(`${URL}${endpoint}`, {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
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

exports.getAddressHistory = getAddressHistory;

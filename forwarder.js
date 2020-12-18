/*jslint node: true */
"use strict";

const bitcoin = require('bitcoinjs-lib');
const tatum = require('@tatumio/tatum');
const blockchain_ws = require('./blockchain_ws.js');
const blockcypher = require('./blockcypher.js');
const db = require('ocore/db.js');
const mutex = require('ocore/mutex.js');
const addresses = require('./addresses.js');

async function onReceivedPayment(tx) {
	const unlock = await mutex.lock('received_tx');
	console.log('received payment', JSON.stringify(tx, null, 2));
	const hash = tx.hash || tx.txid;
	const forwards = await db.query("SELECT 1 FROM forwards WHERE user_txid=?", [hash]);
	if (forwards.length > 0) {
		console.log(`payment ${hash} already forwarded`);
		return unlock();
	}
	const outputs = tx.out || tx.outputs;
	if (!outputs)
		throw Error(`no outputs in payload ${JSON.stringify(tx)}`);
	for (let i = 0; i < outputs.length; i++) {
		const output = outputs[i];
		const address = output.addr || output.address || output.addresses[0];
		if (!address)
			throw Error(`no address in output ${output}`);
		const [swap] = await db.query("SELECT * FROM swaps WHERE in_coin='BTC' AND in_address=?", [address]);
		if (!swap)
			continue;
		await db.query("UPDATE swaps SET status='received', in_amount=? WHERE swap_id=?", [output.value / 1e8, swap.swap_id]);

		const privateKey = await addresses.getPrivateKey(swap.in_coin, swap.in_address_index);
		console.log({privateKey})
		const fee = Math.round(200 * process.env.bitcoin_fee_sats_per_byte); // 200 bytes
		const forwarded_amount = (output.value - fee) / 1e8;
		const body = new tatum.TransferBtcBasedBlockchain();
		body.fromUTXO = [{
			txHash: hash,
			index: i,
			privateKey: privateKey,
		}];
		body.to = [{
			address: process.env.btcDepositAddress,
			value: forwarded_amount,
		}];

		const data = await tatum.prepareBitcoinSignedTransaction(process.env.testnet, body);
		console.log({data})
		const resp = await tatum.sendBitcoinTransaction(process.env.testnet, body);
		console.log({resp})

		/*
		const child = addresses.getChild(swap.in_address_index);
		const wif = child.toWIF();
		console.log({wif})
		const ecPair = bitcoin.ECPair.fromWIF(wif);
		console.log('ecPair', ecPair)
		
		const input = {
			hash: payload.hash,
			index: i,
			witnessUtxo: {
				script: Buffer.from(output.script, 'hex'),
				value: output.value,
			},
		};
		const fee = 2000;
		const forwardedValue = output.value - fee;
		const psbt = new bitcoin.Psbt();
		psbt.addInput(input);
		psbt.addOutput({ address: process.env.depositAddress, value: forwardedValue });
		psbt.signInput(0, ecPair);
		psbt.validateSignaturesOfInput(0);
		psbt.finalizeAllInputs();
		const hex = psbt.extractTransaction().toHex();
		console.log({hex})*/

		await db.query("INSERT INTO forwards (txid, user_txid, swap_id, amount) VALUES(?,?,?,?)", [resp.txId, hash, swap.swap_id, forwarded_amount]);
		await db.query("UPDATE swaps SET status='forwarded', forwarded_amount=? WHERE swap_id=?", [forwarded_amount, swap.swap_id]);
		return unlock();
	}
	console.log(`received notification about payment to a foreign address`); // e.g. from in_address
	unlock();
}

async function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkForNewPayments() {
	console.log("will check for new payments");
	const rows = await db.query("SELECT in_address FROM swaps WHERE in_coin='BTC' AND status='waiting' AND creation_date > " + db.addTime("-7 DAY") + " ORDER BY swap_id DESC");
	for (let { in_address } of rows) {
		const history = await blockcypher.getAddressHistory(in_address);
		console.log("transactions", in_address, history);
		for (let tx of history.txs) {
			await onReceivedPayment(tx);
		}
		await wait(1000); // avoid rate limiting (10 sec for blockchain.info)
	}
	console.log("finished checking for new payments");
}


/*
function createPayment(_type, keys, network) {
	network = network || regtest;
	const splitType = _type.split('-').reverse();
  
	let payment;
	splitType.forEach(type => {
		if (['p2sh', 'p2wsh'].indexOf(type) > -1) {
			payment = (bitcoin.payments)[type]({
				redeem: payment,
				network,
			});
		} else {
			payment = (bitcoin.payments)[type]({
				pubkey: keys[0].publicKey,
				network,
			});
		}
	});
  
	return {
		payment,
		keys,
	};
}
*/

async function start() {
	blockchain_ws.on('utx', onReceivedPayment);
	const rows = await db.query("SELECT in_address FROM swaps WHERE in_coin='BTC' AND status='waiting' AND creation_date > "+ db.addTime("-7 DAY"));
	for (let { in_address } of rows)
		blockchain_ws.subscribeToAddress(in_address);
	await checkForNewPayments();
	setInterval(checkForNewPayments, 600 * 1000);
}

exports.start = start;

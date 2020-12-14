/*jslint node: true */
'use strict';
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const tatum = require('@tatumio/tatum');
const db = require('ocore/db.js');


function getMnemonic() {
	if (!process.env.mnemonic) {
		console.log("no mnemonic yet, will generate");
		process.env.mnemonic = bip39.generateMnemonic();
		const fs = require('fs')
		const path = require('path');
		const envPath = path.dirname(process.mainModule.paths[0]) + '/.env';
		let contents = fs.readFileSync(envPath, 'utf8');
		contents += `\nmnemonic = "${process.env.mnemonic}"\n`;
		fs.writeFileSync(envPath, contents);
	}
	return process.env.mnemonic;
}

function getChild(index) {
	const mnemonic = getMnemonic();
	const seed = bip39.mnemonicToSeedSync(mnemonic);
//	console.log('seed', seed)
	const root = bip32.fromSeed(seed);
//	console.log('root', root)

	const path = "m/49'/1'/0'/0/" + index;
	const child = root.derivePath(path);
	return child;
}

async function getPrivateKey(in_coin, index) {
	const currency = tatum.Currency[in_coin];
	return await tatum.generatePrivateKeyFromMnemonic(currency, process.env.testnet, getMnemonic(), index);
}

async function genNextAddress(in_coin) {
	const [{ last_index }] = await db.query("SELECT MAX(in_address_index) AS last_index FROM swaps WHERE in_coin=?", [in_coin]);
	const index = typeof last_index === 'number' ? last_index + 1 : 0;

	const currency = tatum.Currency[in_coin];
	console.log({currency})
	const wallet = await tatum.generateWallet(currency, process.env.testnet, getMnemonic());
	console.log('wallet', wallet)
	const address = tatum.generateAddressFromXPub(currency, process.env.testnet, wallet.xpub, index);
	console.log(`generated address`, { index, address });
	return { index, address };

/*
	const child = getChild(index);
//	console.log('child', child)
//	child.toWIF();
	
	const redeem = bitcoin.payments.p2wpkh({
		pubkey: child.publicKey,
		network: bitcoin.networks.bitcoin,
	});
	console.log('redeem', redeem, 'address', redeem.address)

	const { address } = bitcoin.payments.p2sh({
		redeem: redeem,
		network: bitcoin.networks.bitcoin,
	});
	console.log(`generated address`, { index, address });
	return { index, address };*/
}

exports.getChild = getChild;
exports.getPrivateKey = getPrivateKey;
exports.genNextAddress = genNextAddress;


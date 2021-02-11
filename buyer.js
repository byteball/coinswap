/*jslint node: true */
'use strict';
const db = require('ocore/db.js');
const mutex = require('ocore/mutex.js');
const bittrex = require('./bittrex.js');


async function checkDeposits() {
	const unlock = await mutex.lock('deposits');
	console.log("will check for new deposits");
	const rows = await db.query("SELECT txid, in_address, out_address, swap_id FROM forwards CROSS JOIN swaps USING(swap_id) WHERE forward_status='sent' AND forward_date > " + db.addTime("-3 DAY"));
	if (rows.length === 0) {
		console.log("we don't expect any deposits");
		return unlock();
	}
	console.log('expecting deposits', rows);
	const forwards = {};
	for (let row of rows)
		forwards[row.txid] = row;
	const deposits = await bittrex.getDeposits();
	for (let deposit of deposits) {
		const forward = forwards[deposit.txid];
		if (!forward)
			continue;
		console.log('deposit', deposit);
		if (deposit.status !== 'ok') {
			console.log(`deposit ${deposit.txid} from ${forward.in_address} to ${forward.out_address} is still ${deposit.status}`);
			continue;
		}
		const out_amount = await buy(deposit.amount, deposit.currency, forward.out_address);
		await db.query("UPDATE forwards SET forward_status='received' WHERE txid=?", [deposit.txid]);
		await db.query("UPDATE swaps SET status='sent', out_amount=? WHERE swap_id=?", [out_amount, forward.swap_id]);
	}
	unlock();
}

async function buy(deposit_amount, deposit_currency, out_address) {
	if (deposit_currency !== 'BTC')
		throw Error(`${deposit_currency} deposits not implemented yet`);
	
	// make sure the deposit is not already spent
	let balances = await bittrex.getBalances();
	if (balances.BTC < deposit_amount)
		throw Error(`our exchange balance ${balances.BTC} is less than the deposit amount ${deposit_amount}`);
	
	// subtract our fee
	const net_amount = (1 - process.env.fee / 100) * deposit_amount;
	
	// calc how much GBYTE we can buy for this amount of BTC
	const { total, err } = await bittrex.getBuyResult(net_amount);
	if (err)
		throw Error(err);
	
	if (net_amount > 0.0005) { // above dust limit
		// market buy
		const resp = await bittrex.marketBuy(total);
		if (resp.status !== 'closed')
			throw Error(`market buy failed ${JSON.stringify(resp)}`);
		const spent = resp.cost + resp.fee.cost;
		console.log(`market buy ${total} GBYTE for ${out_address} done, spent ${spent}`);
	}
	else {
		console.log(`not buying for ${net_amount} BTC as the amount is below Bittrex's dust limit`);
		if (total > balances.GBYTE)
			throw Error(`not enough funds to withdraw ${total} GBYTE for a dust exchange, please refill your account`);
	}
	// withdraw
	await bittrex.withdraw(total, out_address);
	console.log(`submitted withdrawal of ${total} GBYTE to ${out_address}`);
	// we are ignoring the withdrawal fee here

	return total;
}



async function start() {
	await checkDeposits();
	setInterval(checkDeposits, 60 * 1000);
}



exports.start = start;

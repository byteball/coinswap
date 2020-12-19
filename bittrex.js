/*jslint node: true */
'use strict';
const ccxt = require('ccxt');


let bittrex = new ccxt.bittrex({
	apiKey: process.env.apiKey,
	secret: process.env.apiSecret,
});


async function getBuyResult(quote_amount) {
	const orderbook = await bittrex.fetchOrderBook('GBYTE/BTC', 500);
	console.log(orderbook);
	const asks = orderbook.asks;
	const top_price = asks[0][0];
	let final_price;
	let net_quote_amount = quote_amount * (1 - process.env.bittrex_fee / 100);
	let total = 0;
	for (let [price, size] of asks) {
		const quote_size = size * price;
		if (quote_size < net_quote_amount) {
			total += size;
			net_quote_amount -= quote_size;
		}
		else {
			total += net_quote_amount / price;
			final_price = price;
			break;
		}
	}
	if (!final_price)
		return { err: `not enough orders in the orderbook to fill ${quote_amount} BTC` };
	const slippage = (final_price - top_price) / top_price;
	total = ccxt.decimalToPrecision(total, ccxt.TRUNCATE, 8);
	console.log({ total, final_price, slippage });
	return { total, final_price, slippage };
}



async function marketBuy(size) {
	console.log(`will buy ${size}`);
	let m_resp = await bittrex.createMarketBuyOrder('GBYTE/BTC', size);
	console.log('---- market_resp', m_resp);
	return m_resp;
}

async function withdraw(amount, address) {
	console.log(`will withdraw ${amount}`);
	let resp = await bittrex.withdraw('GBYTE', amount, address);
	console.log('---- withdraw resp', resp);
	return resp;
}

async function getBalances() {
	const balances = await bittrex.fetchBalance();
	if (!balances)
		throw Error(`failed to get balances`);
	return balances.free;
}

async function getDeposits() {
	const deposits = await bittrex.fetchDeposits();
	if (!deposits)
		throw Error(`failed to get deposits`);
	return deposits;
}





exports.getBuyResult = getBuyResult;
exports.marketBuy = marketBuy;
exports.withdraw = withdraw;
exports.getBalances = getBalances;
exports.getDeposits = getDeposits;

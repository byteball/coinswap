/*jslint node: true */
"use strict";

const Koa = require('koa');
const KoaRouter = require('koa-router');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');

const ValidationUtils = require('ocore/validation_utils.js');
const db = require('ocore/db.js');
const mutex = require('ocore/mutex.js');
const addresses = require('./addresses.js');
const blockchain_ws = require('./blockchain_ws.js');
const bittrex = require('./bittrex.js');


const minAmounts = {
	BTC: 0.001,
}

const app = new Koa();
const router = new KoaRouter();

app.use(bodyParser());


function setError(ctx, error) {
	ctx.body = {
		status: 'error',
		error: error.toString(),
	};
	console.error('ERROR:', error);
}


router.get('/estimate', async (ctx) => {
	console.error('estimate', ctx.query);
	const swap = ctx.query;
	if (!swap.in_coin)
		swap.in_coin = 'BTC';
	if (swap.in_coin !== 'BTC')
		return setError(ctx, `unsupported in_coin: ${swap.in_coin}`);
	const in_amount = parseFloat(swap.in_amount);
	if (!(in_amount >= minAmounts[swap.in_coin]))
		return setError(ctx, `in_amount must be a number greater than ${minAmounts[swap.in_coin]}`);
	try {
		const { total, err } = await bittrex.getBuyResult(in_amount);
		if (err)
			return setError(ctx, err);
		ctx.body = {
			status: 'success',
			data: total
		};
	}
	catch (err) {
		setError(ctx, err);
	}
});

router.post('/create_swap', async (ctx) => {
	console.error('create_swap ctx', JSON.stringify(ctx, null, 2));
	const swap = ctx.request.body;
	console.error('create_swap', swap);

	if (!swap.in_coin)
		swap.in_coin = 'BTC';
	if (swap.in_coin !== 'BTC')
		return setError(ctx, `unsupported in_coin: ${swap.in_coin}`);
	if (!(typeof swap.in_amount === "number" && swap.in_amount >= minAmounts[swap.in_coin]))
		return setError(ctx, `in_amount must be a number greater than ${minAmounts[swap.in_coin]}`);
	if (!ValidationUtils.isValidAddress(swap.out_address))
		return setError(ctx, `address ${swap.out_address} not valid`);
	const { total: expected_out_amount, err } = await bittrex.getBuyResult(swap.in_amount);
	if (err)
		return setError(ctx, err);
	
	const unlock = await mutex.lock('gen_address');
	const { address: in_address, index: in_address_index } = await addresses.genNextAddress(swap.in_coin);
	const res = await db.query(`INSERT INTO swaps (in_address, in_coin, in_address_index, expected_in_amount, out_address, expected_out_amount) VALUES (?, ?, ?, ?, ?, ?)`, [in_address, swap.in_coin, in_address_index, swap.in_amount, swap.out_address, expected_out_amount]);
	const swap_id = res.insertId;
	unlock();

	blockchain_ws.subscribeToAddress(in_address);
	
	ctx.body = {
		status: 'success',
		data: {
			swap_id,
			in_address,
			expected_out_amount,
		},
	};
});

router.get('/get_status/:swap_id', async (ctx) => {
	console.error('get_status', ctx.params);
	const swap_id = parseFloat(ctx.params.swap_id);
	const [swap] = await db.query("SELECT * FROM swaps WHERE swap_id=?;", [swap_id]);
	if (!swap)
		return setError(ctx, `no such swap: ${swap_id}`);
	ctx.body = {
		status: 'success',
		data: swap
	};
});

app.use(cors());
app.use(router.routes());

function start() {
	app.listen(process.env.webPort);
	console.log(`listening on port ${process.env.webPort}`);
}

exports.start = start;

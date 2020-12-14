CREATE TABLE IF NOT EXISTS swaps (
	swap_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	in_address CHAR(100) NOT NULL,
	in_coin CHAR(10) NOT NULL DEFAULT 'BTC',
	in_address_index INT NOT NULL,
	expected_in_amount DOUBLE NOT NULL,
	in_amount DOUBLE NULL,
	forwarded_amount DOUBLE NULL,
	out_address CHAR(100) NOT NULL,
	out_coin CHAR(10) NOT NULL DEFAULT 'GBYTE',
	expected_out_amount DOUBLE NOT NULL,
	out_amount DOUBLE NULL,
	refund_address CHAR(100) NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_update TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	status VARCHAR(30) NOT NULL DEFAULT 'waiting'
);
-- query separator
CREATE INDEX IF NOT EXISTS byInAddress ON swaps(in_address);
-- query separator
CREATE UNIQUE INDEX IF NOT EXISTS byInCoinInAddressIndex ON swaps(in_coin, in_address_index);
-- query separator
CREATE INDEX IF NOT EXISTS byOutAddress ON swaps(out_address);
-- query separator
CREATE TABLE IF NOT EXISTS forwards (
	txid VARCHAR(100) NOT NULL PRIMARY KEY, -- we forwarded the user's money to the exchange
	user_txid VARCHAR(100) NOT NULL UNIQUE, -- user sent money to us
	swap_id INTEGER NOT NULL,
	amount DOUBLE NOT NULL,
	forward_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	forward_status VARCHAR(30) NOT NULL DEFAULT 'sent',
	FOREIGN KEY (swap_id) REFERENCES swaps(swap_id)
);
-- query separator
CREATE INDEX IF NOT EXISTS bySwapId ON forwards(swap_id);
-- query separator
CREATE INDEX IF NOT EXISTS byForwardStatusDate ON forwards(forward_status, forward_date);



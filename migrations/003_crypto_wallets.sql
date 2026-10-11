-- Migration 003: Crypto Wallet System
-- Integrasi wallet crypto blockchain dengan sistem koin webapp

-- Tabel koin crypto yang didukung
CREATE TABLE IF NOT EXISTS crypto_supported_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  network text NOT NULL,
  contract_address text,
  decimals int NOT NULL DEFAULT 18,
  icon text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  -- 1 unit crypto = berapa koin webapp
  coin_conversion_rate numeric(20, 4) NOT NULL DEFAULT 0,
  min_deposit numeric(20, 8) NOT NULL DEFAULT 0,
  min_withdraw numeric(20, 8) NOT NULL DEFAULT 0,
  withdraw_fee_percent numeric(5, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wallet crypto per pengguna (satu wallet per koin per pengguna)
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  coin_symbol text NOT NULL,
  network text NOT NULL,
  wallet_address text NOT NULL,
  balance numeric(20, 8) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, coin_symbol, network)
);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_account_id ON crypto_wallets(account_id);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets(wallet_address);

-- Transaksi crypto (deposit, withdraw, swap)
CREATE TABLE IF NOT EXISTS crypto_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES crypto_wallets(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdraw', 'swap_to_coins', 'swap_from_coins', 'transfer')),
  coin_symbol text NOT NULL,
  amount_crypto numeric(20, 8) NOT NULL,
  amount_coins int NOT NULL DEFAULT 0,
  tx_hash text,
  from_address text,
  to_address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  description text NOT NULL DEFAULT '',
  block_number bigint,
  gas_fee numeric(20, 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crypto_transactions_wallet_id ON crypto_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_account_id ON crypto_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_tx_hash ON crypto_transactions(tx_hash);

-- Seed data: koin crypto yang didukung
INSERT INTO crypto_supported_coins (symbol, name, network, contract_address, decimals, icon, color, coin_conversion_rate, min_deposit, min_withdraw, withdraw_fee_percent) VALUES
  ('USDT', 'Tether USD', 'TRC20', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 'DollarSign', '#26A17B', 100, 1.0, 5.0, 1.5),
  ('USDT-ERC20', 'Tether USD', 'ERC20', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'DollarSign', '#26A17B', 95, 5.0, 10.0, 2.5),
  ('USDC', 'USD Coin', 'ERC20', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'DollarSign', '#2775CA', 98, 5.0, 10.0, 2.0),
  ('ETH', 'Ethereum', 'ERC20', null, 18, 'Eth', '#627EEA', 350000, 0.001, 0.01, 1.0),
  ('BNB', 'Binance Coin', 'BEP20', null, 18, 'Coins', '#F3BA2F', 600000, 0.005, 0.05, 1.0),
  ('BTC', 'Bitcoin', 'Bitcoin', null, 8, 'Bitcoin', '#F7931A', 50000000, 0.0001, 0.001, 0.5),
  ('SOL', 'Solana', 'Solana', null, 9, 'Zap', '#9945FF', 15000, 0.01, 0.1, 1.0),
  ('MATIC', 'Polygon', 'ERC20', '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', 18, 'Hexagon', '#8247E5', 10000, 1.0, 10.0, 1.5)
ON CONFLICT (symbol) DO NOTHING;

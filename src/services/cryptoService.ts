import axios from 'axios';
import { ethers, HDNodeWallet, Wordlist } from 'ethers';
import * as bip39 from 'bip39';
import { config, CRYPTO_CONFIG } from '../config';
import logger from '../utils/logger';
import nowpaymentsService from './nowpaymentsService';

export interface WalletInfo {
  address: string;
  privateKey: string;
  publicKey?: string;
}

export interface DepositInfo {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  confirmations: number;
  blockHeight?: number;
  timestamp: Date;
}

export interface CryptoRate {
  symbol: string;
  priceUsd: number;
  change24h: number;
}

class CryptoService {
  private rateCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Generate a new wallet for the specified cryptocurrency
   */
  async generateWallet(crypto: string, network: string): Promise<WalletInfo> {
    logger.info(`Generating ${crypto} wallet for ${network}`);

    switch (crypto.toUpperCase()) {
      case 'BTC':
        return this.generateBtcWallet(network);
      case 'ETH':
      case 'USDT':
      case 'USDC':
        if (network === 'erc20' || network === 'mainnet') {
          return this.generateEthereumWallet();
        } else if (network === 'trc20') {
          return this.generateTronWallet();
        } else if (network === 'bep20') {
          return this.generateBscWallet();
        }
        throw new Error(`Unsupported network ${network} for ${crypto}`);
      case 'BNB':
        return this.generateBscWallet();
      case 'TRX':
        return this.generateTronWallet();
      default:
        throw new Error(`Unsupported cryptocurrency: ${crypto}`);
    }
  }

  private async generateBtcWallet(network: string): Promise<WalletInfo> {
    // For production, use a proper Bitcoin library like bitcoinjs-lib
    // This is a simplified version using BlockCypher API
    try {
      const response = await axios.post(
        `https://api.blockcypher.com/v1/btc/${network === 'testnet' ? 'test3' : 'main'}/addrs`,
        { token: config.apis.blockcypher }
      );
      
      return {
        address: response.data.address,
        privateKey: response.data.private,
        publicKey: response.data.public,
      };
    } catch (error) {
      logger.error('Error generating BTC wallet:', error);
      throw new Error('Failed to generate BTC wallet');
    }
  }

  private async generateEthereumWallet(): Promise<WalletInfo> {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
    };
  }

  private async generateBscWallet(): Promise<WalletInfo> {
    // BSC uses the same address format as Ethereum
    return this.generateEthereumWallet();
  }

  private async generateTronWallet(): Promise<WalletInfo> {
    // For production, use a proper Tron library like tronweb
    // This is a placeholder - implement with tronweb
    const mnemonic = bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // Simplified - use tronweb in production
    return {
      address: 'T' + Buffer.from(seed.slice(0, 20)).toString('hex'),
      privateKey: seed.toString('hex'),
    };
  }

  /**
   * Check for deposits on a wallet address
   */
  async checkDeposits(
    crypto: string,
    network: string,
    address: string,
    lastCheckedBlock?: number
  ): Promise<DepositInfo[]> {
    logger.debug(`Checking ${crypto} deposits for ${address}`);

    switch (crypto.toUpperCase()) {
      case 'BTC':
        return this.checkBtcDeposits(address, network, lastCheckedBlock);
      case 'ETH':
        return this.checkEthDeposits(address, lastCheckedBlock);
      case 'USDT':
      case 'USDC':
        if (network === 'erc20') {
          return this.checkErc20Deposits(address, crypto, lastCheckedBlock);
        } else if (network === 'trc20') {
          return this.checkTrc20Deposits(address, crypto);
        }
        return [];
      case 'TRX':
        return this.checkTrxDeposits(address);
      default:
        return [];
    }
  }

  private async checkBtcDeposits(
    address: string,
    network: string,
    lastCheckedBlock?: number
  ): Promise<DepositInfo[]> {
    try {
      const url = network === 'testnet'
        ? `https://api.blockcypher.com/v1/btc/test3/addrs/${address}/full?token=${config.apis.blockcypher}`
        : `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full?token=${config.apis.blockcypher}`;
      
      const response = await axios.get(url);
      const deposits: DepositInfo[] = [];

      for (const tx of response.data.txs || []) {
        if (tx.block_height <= (lastCheckedBlock || 0)) continue;

        for (const output of tx.outputs || []) {
          if (output.addresses?.includes(address)) {
            deposits.push({
              txHash: tx.hash,
              fromAddress: tx.inputs?.[0]?.addresses?.[0] || 'unknown',
              toAddress: address,
              amount: output.value / 100000000, // Satoshis to BTC
              confirmations: tx.confirmations || 0,
              blockHeight: tx.block_height,
              timestamp: new Date(tx.received),
            });
          }
        }
      }

      return deposits;
    } catch (error) {
      logger.error('Error checking BTC deposits:', error);
      return [];
    }
  }

  private async checkEthDeposits(
    address: string,
    lastCheckedBlock?: number
  ): Promise<DepositInfo[]> {
    try {
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=${lastCheckedBlock || 0}&sort=desc&apikey=${config.apis.etherscan}`;
      
      const response = await axios.get(url);
      const deposits: DepositInfo[] = [];

      for (const tx of response.data.result || []) {
        if (tx.to.toLowerCase() === address.toLowerCase() && tx.value > 0) {
          deposits.push({
            txHash: tx.hash,
            fromAddress: tx.from,
            toAddress: address,
            amount: Number(tx.value) / 1e18, // Wei to ETH
            confirmations: tx.confirmations,
            blockHeight: Number(tx.blockNumber),
            timestamp: new Date(Number(tx.timeStamp) * 1000),
          });
        }
      }

      return deposits;
    } catch (error) {
      logger.error('Error checking ETH deposits:', error);
      return [];
    }
  }

  private async checkErc20Deposits(
    address: string,
    tokenSymbol: string,
    lastCheckedBlock?: number
  ): Promise<DepositInfo[]> {
    // ERC20 token addresses
    const tokenAddresses: Record<string, string> = {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    };

    const tokenAddress = tokenAddresses[tokenSymbol.toUpperCase()];
    if (!tokenAddress) return [];

    try {
      const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${address}&startblock=${lastCheckedBlock || 0}&sort=desc&apikey=${config.apis.etherscan}`;
      
      const response = await axios.get(url);
      const deposits: DepositInfo[] = [];

      for (const tx of response.data.result || []) {
        deposits.push({
          txHash: tx.hash,
          fromAddress: tx.from,
          toAddress: address,
          amount: Number(tx.value) / Math.pow(10, Number(tx.tokenDecimal)),
          confirmations: tx.confirmations,
          blockHeight: Number(tx.blockNumber),
          timestamp: new Date(Number(tx.timeStamp) * 1000),
        });
      }

      return deposits;
    } catch (error) {
      logger.error('Error checking ERC20 deposits:', error);
      return [];
    }
  }

  private async checkTrc20Deposits(
    address: string,
    tokenSymbol: string
  ): Promise<DepositInfo[]> {
    // For production, use TronGrid API
    // This is a placeholder
    logger.debug(`Checking TRC20 deposits for ${tokenSymbol} at ${address}`);
    return [];
  }

  private async checkTrxDeposits(address: string): Promise<DepositInfo[]> {
    // For production, use TronGrid API
    logger.debug(`Checking TRX deposits at ${address}`);
    return [];
  }

  /**
   * Get current crypto price in USD
   * Optionally accepts a coingeckoId for better coin identification
   */
  async getCryptoRate(symbol: string, coingeckoId?: string): Promise<CryptoRate | null> {
    const cached = this.rateCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        symbol,
        priceUsd: cached.price,
        change24h: 0,
      };
    }

    try {
      const coinId = coingeckoId || this.getCoinGeckoId(symbol);
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
      );

      const data = response.data[coinId];
      if (data) {
        this.rateCache.set(symbol, { price: data.usd, timestamp: Date.now() });
        return {
          symbol,
          priceUsd: data.usd,
          change24h: data.usd_24h_change || 0,
        };
      }
      return null;
    } catch (error) {
      logger.error('Error fetching crypto rate:', error);
      return null;
    }
  }

  private getCoinGeckoId(symbol: string): string {
    const ids: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDT: 'tether',
      USDC: 'usd-coin',
      BNB: 'binancecoin',
      TRX: 'tron',
      XRP: 'ripple',
      ADA: 'cardano',
      DOGE: 'dogecoin',
      SOL: 'solana',
      DOT: 'polkadot',
      MATIC: 'matic-network',
      LTC: 'litecoin',
      BCH: 'bitcoin-cash',
      LINK: 'chainlink',
      UNI: 'uniswap',
      ATOM: 'cosmos',
      ETC: 'ethereum-classic',
      XLM: 'stellar',
      ALGO: 'algorand',
      AVAX: 'avalanche-2',
      FTM: 'fantom',
      NEAR: 'near',
      APT: 'aptos',
      OP: 'optimism',
      ARB: 'arbitrum',
      TON: 'the-open-network',
      XMR: 'monero',
      FIL: 'filecoin',
      VET: 'vechain',
      SHIB: 'shiba-inu',
    };
    return ids[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  /**
   * Get all supported crypto rates
   * Supports NOWPayments coins if enabled
   */
  async getAllRates(): Promise<CryptoRate[]> {
    const rates: CryptoRate[] = [];
    
    // If NOWPayments is enabled, get rates for all available coins
    if (config.crypto.useNowPayments && config.apis.nowpayments) {
      try {
        const npCurrencies = await nowpaymentsService.getSortedCurrencies();
        
        // Get rates for all popular coins + limit to top 50 to avoid rate limiting
        const coinsToFetch = npCurrencies.slice(0, 50);
        
        for (const currency of coinsToFetch) {
          const rate = await this.getCryptoRate(currency.symbol, currency.coingeckoId);
          if (rate) {
            rates.push(rate);
          }
        }
        
        return rates;
      } catch (error) {
        logger.error('Error fetching NOWPayments rates, falling back to config:', error);
      }
    }
    
    // Fallback to config supported cryptos
    for (const crypto of config.crypto.supportedCryptos) {
      const rate = await this.getCryptoRate(crypto);
      if (rate) {
        rates.push(rate);
      }
    }
    return rates;
  }

  /**
   * Calculate exchange amount with fees
   */
  calculateExchange(
    cryptoAmount: number,
    cryptoSymbol: string,
    priceUsd: number
  ): {
    grossUsd: number;
    feePercent: number;
    feeUsd: number;
    netUsd: number;
  } {
    const grossUsd = cryptoAmount * priceUsd;
    const feePercent = config.crypto.exchangeFeePercent;
    const feeUsd = grossUsd * (feePercent / 100);
    const netUsd = grossUsd - feeUsd;

    return {
      grossUsd: Math.round(grossUsd * 100) / 100,
      feePercent,
      feeUsd: Math.round(feeUsd * 100) / 100,
      netUsd: Math.round(netUsd * 100) / 100,
    };
  }
}

export const cryptoService = new CryptoService();
export default cryptoService;

import axios from 'axios';
import logger, { logError } from '../utils/logger';

export interface NowPaymentsCurrency {
  id: string;
  code: string;
  name: string;
  enable: boolean;
  wallet_regex: string;
  priority: number;
  extra_id_exists: boolean;
  extra_id_regex: string | null;
  logo_url: string;
  track: boolean;
  cg_id: string;
  is_maxlimit: boolean;
  network: string;
  smart_contract: string | null;
  network_precision: string;
  explorer_link_hash: string;
  confirmations_from: string;
  order: number;
  is_delisted: boolean;
}

export interface NowPaymentsMinAmount {
  currency_from: string;
  currency_to: string;
  min_amount: number;
}

export interface NowPaymentsEstimate {
  currency_from: string;
  amount_from: number;
  currency_to: string;
  estimated_amount: number;
}

export interface NowPaymentsPayment {
  payment_id: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  ipn_callback_url: string;
  created_at: string;
  updated_at: string;
  purchase_id: number;
  amount_received: number | null;
  payin_extra_id: string | null;
  smart_contract: string | null;
  network: string | null;
  network_precision: string | null;
  burning_percent: string | null;
  expiration_estimate_date: string;
}

export interface CryptoConfigItem {
  name: string;
  symbol: string;
  code: string;
  networks: string[];
  confirmations: number;
  minAmount: number;
  logoUrl: string;
  priority: number;
  isPopular: boolean;
  coingeckoId: string;
}

// Popular coins that should appear first (sorted by popularity/importance)
const POPULAR_COIN_CODES = [
  'btc',      // Bitcoin
  'eth',      // Ethereum
  'usdt',     // Tether
  'usdc',     // USD Coin
  'bnb',      // BNB
  'xrp',      // XRP
  'ada',      // Cardano
  'doge',     // Dogecoin
  'sol',      // Solana
  'trx',      // Tron
  'dot',      // Polkadot
  'matic',    // Polygon
  'ltc',      // Litecoin
  'bch',      // Bitcoin Cash
  'link',     // Chainlink
  'uni',      // Uniswap
  'atom',     // Cosmos
  'etc',      // Ethereum Classic
  'xlm',      // Stellar
  'algo',     // Algorand
];

class NowPaymentsService {
  private apiKey: string;
  private baseUrl = 'https://api.nowpayments.io/v1';
  private currencyCache: Map<string, { currencies: CryptoConfigItem[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get all available currencies from NOWPayments
   */
  async getCurrencies(): Promise<NowPaymentsCurrency[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/currencies`, {
        headers: this.getHeaders(),
      });
      return response.data.currencies || [];
    } catch (error) {
      logError('Error fetching NOWPayments currencies', error);
      return [];
    }
  }

  /**
   * Get available currencies for payments (filtered and enabled)
   */
  async getAvailableCurrencies(): Promise<NowPaymentsCurrency[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/merchant/coins`, {
        headers: this.getHeaders(),
      });
      return response.data.selectedCurrencies || [];
    } catch (error) {
      logError('Error fetching NOWPayments available currencies', error);
      return [];
    }
  }

  /**
   * Get cryptocurrency configuration with popular coins first
   */
  async getCryptoConfig(): Promise<Record<string, CryptoConfigItem>> {
    const cached = this.currencyCache.get('config');
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return this.convertToConfigObject(cached.currencies);
    }

    const currencies = await this.getAvailableCurrencies();
    
    if (currencies.length === 0) {
      logger.warn('No currencies fetched from NOWPayments, using fallback');
      return this.getFallbackConfig();
    }

    // Process and sort currencies
    const processedCurrencies = this.processCurrencies(currencies);
    
    // Cache the processed currencies
    this.currencyCache.set('config', {
      currencies: processedCurrencies,
      timestamp: Date.now(),
    });

    return this.convertToConfigObject(processedCurrencies);
  }

  /**
   * Get sorted list of currencies (popular first)
   */
  async getSortedCurrencies(): Promise<CryptoConfigItem[]> {
    const config = await this.getCryptoConfig();
    return Object.values(config).sort((a, b) => {
      // Popular coins come first
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      
      // Within popular/non-popular, sort by priority
      return a.priority - b.priority;
    });
  }

  /**
   * Get list of popular coins only
   */
  async getPopularCoins(): Promise<CryptoConfigItem[]> {
    const sorted = await this.getSortedCurrencies();
    return sorted.filter(c => c.isPopular);
  }

  /**
   * Process raw currencies from API into our format
   */
  private processCurrencies(currencies: NowPaymentsCurrency[]): CryptoConfigItem[] {
    // Group by code to handle multi-network coins
    const groupedByCode = new Map<string, NowPaymentsCurrency[]>();
    
    for (const currency of currencies) {
      if (!currency.enable || currency.is_delisted) continue;
      
      const code = currency.code.toLowerCase();
      if (!groupedByCode.has(code)) {
        groupedByCode.set(code, []);
      }
      groupedByCode.get(code)!.push(currency);
    }

    const processed: CryptoConfigItem[] = [];

    for (const [code, variants] of groupedByCode) {
      // Sort variants by priority/order
      variants.sort((a, b) => (a.order || 999) - (b.order || 999));
      
      const primary = variants[0];
      const popularIndex = POPULAR_COIN_CODES.indexOf(code);
      const isPopular = popularIndex !== -1;
      
      // Extract networks from variants
      const networks = variants
        .map(v => v.network?.toLowerCase() || 'mainnet')
        .filter((n, i, arr) => arr.indexOf(n) === i); // Unique

      // Use default values if not specified
      const confirmations = parseInt(primary.confirmations_from) || 3;
      const minAmount = this.getMinAmountForCoin(code);

      processed.push({
        name: primary.name,
        symbol: primary.code.toUpperCase(),
        code: primary.code.toLowerCase(),
        networks: networks.length > 0 ? networks : ['mainnet'],
        confirmations,
        minAmount,
        logoUrl: primary.logo_url,
        priority: isPopular ? popularIndex : (primary.order || 999) + 100,
        isPopular,
        coingeckoId: primary.cg_id || primary.code.toLowerCase(),
      });
    }

    // Sort: popular first, then by priority
    return processed.sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return a.priority - b.priority;
    });
  }

  /**
   * Convert currency array to config object keyed by symbol
   */
  private convertToConfigObject(currencies: CryptoConfigItem[]): Record<string, CryptoConfigItem> {
    const config: Record<string, CryptoConfigItem> = {};
    for (const currency of currencies) {
      config[currency.symbol] = currency;
    }
    return config;
  }

  /**
   * Get minimum amount based on coin type
   */
  private getMinAmountForCoin(code: string): number {
    const minAmounts: Record<string, number> = {
      'btc': 0.0001,
      'eth': 0.001,
      'usdt': 1,
      'usdc': 1,
      'bnb': 0.01,
      'xrp': 0.1,
      'ada': 1,
      'doge': 10,
      'sol': 0.01,
      'trx': 10,
      'dot': 0.1,
      'matic': 0.1,
      'ltc': 0.01,
      'bch': 0.001,
    };
    return minAmounts[code.toLowerCase()] || 0.01;
  }

  /**
   * Get fallback config if API fails
   */
  private getFallbackConfig(): Record<string, CryptoConfigItem> {
    const fallback: Record<string, CryptoConfigItem> = {
      'BTC': {
        name: 'Bitcoin',
        symbol: 'BTC',
        code: 'btc',
        networks: ['mainnet'],
        confirmations: 3,
        minAmount: 0.0001,
        logoUrl: '',
        priority: 0,
        isPopular: true,
        coingeckoId: 'bitcoin',
      },
      'ETH': {
        name: 'Ethereum',
        symbol: 'ETH',
        code: 'eth',
        networks: ['erc20'],
        confirmations: 12,
        minAmount: 0.001,
        logoUrl: '',
        priority: 1,
        isPopular: true,
        coingeckoId: 'ethereum',
      },
      'USDT': {
        name: 'Tether USD',
        symbol: 'USDT',
        code: 'usdt',
        networks: ['erc20', 'trc20', 'bep20'],
        confirmations: 12,
        minAmount: 1,
        logoUrl: '',
        priority: 2,
        isPopular: true,
        coingeckoId: 'tether',
      },
      'USDC': {
        name: 'USD Coin',
        symbol: 'USDC',
        code: 'usdc',
        networks: ['erc20', 'trc20', 'bep20'],
        confirmations: 12,
        minAmount: 1,
        logoUrl: '',
        priority: 3,
        isPopular: true,
        coingeckoId: 'usd-coin',
      },
      'BNB': {
        name: 'BNB',
        symbol: 'BNB',
        code: 'bnb',
        networks: ['bep20'],
        confirmations: 15,
        minAmount: 0.01,
        logoUrl: '',
        priority: 4,
        isPopular: true,
        coingeckoId: 'binancecoin',
      },
      'TRX': {
        name: 'Tron',
        symbol: 'TRX',
        code: 'trx',
        networks: ['trc20'],
        confirmations: 19,
        minAmount: 10,
        logoUrl: '',
        priority: 9,
        isPopular: true,
        coingeckoId: 'tron',
      },
    };
    return fallback;
  }

  /**
   * Create a payment request
   */
  async createPayment(
    priceAmount: number,
    priceCurrency: string,
    payCurrency: string,
    orderId?: string,
    orderDescription?: string
  ): Promise<NowPaymentsPayment | null> {
    try {
      const payload: Record<string, unknown> = {
        price_amount: priceAmount,
        price_currency: priceCurrency.toLowerCase(),
        pay_currency: payCurrency.toLowerCase(),
      };

      if (orderId) payload.order_id = orderId;
      if (orderDescription) payload.order_description = orderDescription;

      const response = await axios.post(`${this.baseUrl}/payment`, payload, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      logError('Error creating NOWPayments payment', error);
      return null;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: number): Promise<NowPaymentsPayment | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/payment/${paymentId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      logError('Error fetching payment status', error);
      return null;
    }
  }

  /**
   * Get minimum payment amount for a currency pair
   */
  async getMinAmount(currencyFrom: string, currencyTo: string = 'usd'): Promise<number> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/min-amount?currency_from=${currencyFrom.toLowerCase()}&currency_to=${currencyTo.toLowerCase()}`,
        { headers: this.getHeaders() }
      );
      return response.data.min_amount || 0;
    } catch (error) {
      logError('Error fetching min amount', error);
      return 0;
    }
  }

  /**
   * Get estimated exchange amount
   */
  async getEstimate(
    amount: number,
    currencyFrom: string,
    currencyTo: string = 'usd'
  ): Promise<number | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/estimate?amount=${amount}&currency_from=${currencyFrom.toLowerCase()}&currency_to=${currencyTo.toLowerCase()}`,
        { headers: this.getHeaders() }
      );
      return response.data.estimated_amount || null;
    } catch (error) {
      logError('Error fetching estimate', error);
      return null;
    }
  }

  /**
   * Get list of available full currencies (with more details)
   */
  async getFullCurrencies(): Promise<NowPaymentsCurrency[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/full-currencies`, {
        headers: this.getHeaders(),
      });
      return response.data.currencies || [];
    } catch (error) {
      logError('Error fetching full currencies', error);
      return [];
    }
  }

  /**
   * Check if API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      await axios.get(`${this.baseUrl}/status`, {
        headers: this.getHeaders(),
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    // Clear cache when API key changes
    this.currencyCache.clear();
  }
}

// Export singleton instance
export const nowpaymentsService = new NowPaymentsService(process.env.NOWPAYMENTS_API_KEY);
export default nowpaymentsService;

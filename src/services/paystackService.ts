import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import logger, { logError } from '../utils/logger';

export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
  logo_url: string | null;
}

export interface PaystackAccountResponse {
  account_number: string;
  account_name: string;
  bank_id: number;
  bank_name: string;
}

class PaystackService {
  private client: AxiosInstance;

  constructor() {
    if (!config.paystack.secretKey) {
      logger.warn('PAYSTACK_SECRET_KEY is not configured');
    }

    this.client = axios.create({
      baseURL: config.paystack.baseUrl,
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch list of Nigerian banks from Paystack
   */
  async getNigerianBanks(): Promise<PaystackBank[]> {
    try {
      const response = await this.client.get('/bank', {
        params: { country: 'nigeria' },
      });

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to fetch banks');
      }

      return response.data.data;
    } catch (error) {
      logError('Error fetching Paystack banks', error);
      throw error;
    }
  }

  /**
   * Resolve bank account number using Paystack
   */
  async resolveAccount(accountNumber: string, bankCode: string): Promise<PaystackAccountResponse> {
    try {
      const response = await this.client.get('/bank/resolve', {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to resolve account');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        logError('Paystack resolve error', errorData);
        throw new Error(errorData.message || 'Failed to resolve account');
      }
      logError('Error resolving Paystack account', error);
      throw error;
    }
  }
}

export const paystackService = new PaystackService();
export default paystackService;

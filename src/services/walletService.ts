import { prisma } from '../utils/db';
import { Wallet } from '@prisma/client';
import cryptoService from './cryptoService';
import logger from '../utils/logger';

class WalletService {
  /**
   * Generate and store a new wallet for user
   */
  async createWallet(
    userId: string,
    cryptocurrency: string,
    network: string
  ): Promise<Wallet> {
    logger.info(`Creating ${cryptocurrency} wallet for user ${userId}`);

    // Check if user already has a wallet for this crypto/network
    const existing = await prisma.wallet.findFirst({
      where: {
        userId,
        cryptocurrency,
        network,
        isActive: true,
      },
    });

    if (existing) {
      logger.debug(`Returning existing wallet: ${existing.address}`);
      return existing;
    }

    // Generate new wallet
    const walletInfo = await cryptoService.generateWallet(cryptocurrency, network);

    // Store wallet (encrypt private key in production!)
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        cryptocurrency,
        network,
        address: walletInfo.address,
        privateKey: walletInfo.privateKey, // TODO: Encrypt this!
        publicKey: walletInfo.publicKey,
      },
    });

    logger.info(`Created wallet: ${wallet.address}`);
    return wallet;
  }

  /**
   * Get wallet by ID
   */
  async getById(id: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({
      where: { id },
    });
  }

  /**
   * Get wallet by address
   */
  async getByAddress(address: string): Promise<Wallet | null> {
    return prisma.wallet.findUnique({
      where: { address },
      include: { user: true },
    });
  }

  /**
   * Get user's wallets
   */
  async getUserWallets(userId: string): Promise<Wallet[]> {
    return prisma.wallet.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
  }

  /**
   * Get all active wallets (for deposit checking)
   */
  async getAllActive(): Promise<Wallet[]> {
    return prisma.wallet.findMany({
      where: { isActive: true },
      include: { user: true },
    });
  }

  /**
   * Update wallet balance
   */
  async updateBalance(id: string, balance: number): Promise<Wallet> {
    return prisma.wallet.update({
      where: { id },
      data: { balance },
    });
  }

  /**
   * Deactivate wallet
   */
  async deactivate(id: string): Promise<Wallet> {
    return prisma.wallet.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get or create wallet for transaction
   */
  async getOrCreateForTransaction(
    userId: string,
    cryptocurrency: string,
    network: string
  ): Promise<Wallet> {
    const existing = await prisma.wallet.findFirst({
      where: {
        userId,
        cryptocurrency,
        network,
        isActive: true,
      },
    });

    if (existing) {
      return existing;
    }

    return this.createWallet(userId, cryptocurrency, network);
  }
}

export const walletService = new WalletService();
export default walletService;

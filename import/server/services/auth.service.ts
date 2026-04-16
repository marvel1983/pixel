import bcrypt from 'bcrypt';
import { DbAdapter } from '../db';
import { ClientUsersRepository } from '../repositories/client-users.repository';
import { TokensRepository } from '../repositories/tokens.repository';
import { BranchRepository } from '../repositories/branch.repository';
import { AdminAuditRepository } from '../repositories/admin-audit.repository';
import { MarketsRepository } from '../repositories/markets.repository';
import { verifyPassword, getHashType } from '../utils/passwordVerify';
import type {
  ClientUser,
  InsertClientUser,
  CreateClientUserInput,
  ClientUserWithCustomer,
  Branch,
  BranchCreateDTO,
  BranchStaff,
  BranchStaffCreateDTO,
} from '@shared/schema';
import { log } from '../middleware/logging';

/**
 * AuthService
 *
 * Orchestrates authentication workflows across multiple user types.
 *
 * Responsibilities:
 * - Client user authentication (bcrypt + token issuance)
 * - Branch/staff authentication
 * - Email verification workflows
 * - Password management (hashing + updates)
 * - Session management (dual-token coordination)
 * - Upsert workflows for customer portal users
 *
 * Security Patterns:
 * - Password hashing with bcrypt (10 rounds)
 * - Status checks before authentication
 * - Last login timestamp updates
 * - Email verification enforcement
 * - Market isolation via repository layer
 *
 * Dependencies:
 * - ClientUsersRepository: User CRUD
 * - TokensRepository: Dual-token system
 * - BranchRepository: Branch management
 * - AdminAuditRepository: Admin operations
 * - MarketsRepository: Market validation
 */
export class AuthService {
  private readonly clientUsersRepo: ClientUsersRepository;
  private readonly tokensRepo: TokensRepository;
  private readonly branchesRepo: BranchRepository;
  private readonly adminAuditRepo: AdminAuditRepository;
  private readonly marketsRepo: MarketsRepository;

  constructor(private readonly db: DbAdapter) {
    this.clientUsersRepo = new ClientUsersRepository(db);
    this.tokensRepo = new TokensRepository(db);
    this.branchesRepo = new BranchRepository(db);
    this.adminAuditRepo = new AdminAuditRepository(db);
    this.marketsRepo = new MarketsRepository(db);
  }

  /**
   * Authenticate client user
   *
   * Workflow:
   * 1. Retrieve user with customer data
   * 2. Verify status is active
   * 3. Verify password hash exists
   * 4. Compare password with bcrypt
   * 5. Update last login timestamp
   * 6. Return user with customer
   *
   * Returns null if authentication fails
   */
  async authenticateClientUser(
    email: string,
    password: string
  ): Promise<ClientUserWithCustomer | null> {
    // Retrieve user with customer data
    const userWithCustomer =
      await this.clientUsersRepo.getClientUserWithCustomer(email);

    if (userWithCustomer?.status !== 'active') {
      return null;
    }

    // Verify password hash exists
    if (!userWithCustomer.passwordHash) {
      log.error('Password hash is null or undefined for user', { email });
      return null;
    }

    // Verify password (supports bcrypt and ASP.NET Core Identity V3)
    try {
      const isValidPassword = await verifyPassword(
        password,
        userWithCustomer.passwordHash
      );
      if (!isValidPassword) {
        return null;
      }

      // Migrate legacy hashes to bcrypt on successful login
      const hashType = getHashType(userWithCustomer.passwordHash);
      if (hashType !== 'bcrypt') {
        const newHash = await bcrypt.hash(password, 10);
        await this.clientUsersRepo.updateClientUserPassword(
          userWithCustomer.id,
          newHash,
          false
        );
        log.info('Migrated password hash to bcrypt', {
          userId: userWithCustomer.id,
          fromType: hashType,
        });
      }
    } catch (error) {
      log.error('Error during password comparison', { email, error });
      return null;
    }

    // Update last login timestamp
    await this.clientUsersRepo.updateLastLogin(userWithCustomer.id);

    return userWithCustomer;
  }

  /**
   * Create new client user with plaintext password
   *
   * IMPORTANT: This method expects PLAINTEXT password only.
   * The password will be hashed with bcrypt before storing in database.
   * Never pass pre-hashed passwords (passwordHash) to this method.
   *
   * Workflow:
   * 1. Extract plaintext password from input
   * 2. Hash password with bcrypt (10 rounds)
   * 3. Create user in database with hashed password
   * 4. Return created user
   *
   * Type Safety: CreateClientUserInput explicitly excludes passwordHash field
   * to prevent double-hashing bugs.
   */
  async createClientUser(userData: CreateClientUserInput): Promise<ClientUser> {
    const { password, ...clientUserData } = userData;
    const passwordHash = await bcrypt.hash(password, 10);

    // clientUserData is Omit<InsertClientUser, 'passwordHash'> (from CreateClientUserInput)
    // Adding passwordHash creates InsertClientUser & { passwordHash } (repository contract)
    return await this.clientUsersRepo.createClientUser({
      ...clientUserData,
      passwordHash,
    } as InsertClientUser & { passwordHash: string });
  }

  /**
   * Upsert client user for customer
   *
   * Workflow:
   * 1. Hash password with bcrypt
   * 2. Check if user exists for customer
   * 3. Update existing or create new user
   * 4. Return user record
   *
   * Used for customer portal account creation
   */
  async upsertClientUserForCustomer(
    customerId: string,
    email: string,
    password: string,
    forceChange?: boolean,
    emailVerified?: boolean
  ): Promise<ClientUser> {
    const passwordHash = await bcrypt.hash(password, 10);

    return await this.clientUsersRepo.upsertClientUserForCustomer(
      customerId,
      email,
      passwordHash,
      forceChange,
      emailVerified
    );
  }

  /**
   * Update client user password
   *
   * Workflow:
   * 1. Hash new password with bcrypt
   * 2. Update user record
   * 3. Optionally force password change on next login
   */
  async updateClientUserPassword(
    userId: string,
    password: string,
    forceChange?: boolean
  ): Promise<ClientUser | undefined> {
    const passwordHash = await bcrypt.hash(password, 10);

    return await this.clientUsersRepo.updateClientUserPassword(
      userId,
      passwordHash,
      forceChange
    );
  }

  /**
   * Create access token session
   *
   * Workflow:
   * 1. Generate access token (15 minutes)
   * 2. Return token + expiration
   *
   * Used for short-lived API authentication
   */
  async createAccessToken(
    userId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    return await this.tokensRepo.createAccessToken(userId);
  }

  /**
   * Get user by access token
   *
   * Workflow:
   * 1. Validate access token
   * 2. Retrieve user with customer data
   * 3. Return user or null if expired/invalid
   */
  async getSessionUserByAccessToken(
    token: string
  ): Promise<ClientUserWithCustomer | null> {
    const session = await this.tokensRepo.getSessionByAccessToken(token);

    if (!session) {
      return null;
    }

    return await this.clientUsersRepo.getClientUserById(session.userId);
  }

  /**
   * Delete access token (logout)
   */
  async deleteAccessToken(token: string): Promise<void> {
    await this.tokensRepo.deleteAccessToken(token);
  }

  /**
   * Create refresh token
   *
   * Workflow:
   * 1. Generate refresh token (7 days)
   * 2. Store with realm scoping
   * 3. Return token + expiration
   *
   * Realms: 'client' for customers, 'branch' for POS
   * TYPE SAFE: Accepts object params with discriminated union
   */
  async createRefreshToken(
    userId: string,
    realm: 'admin' | 'client' | 'branch',
    marketId?: string,
    branchId?: string
  ): Promise<{ token: string; expiresAt: Date }> {
    // Convert to type-safe params object
    if (realm === 'branch') {
      if (!marketId || !branchId) {
        throw new Error(
          'marketId and branchId are required for branch refresh tokens'
        );
      }
      return await this.tokensRepo.createRefreshToken({
        userId,
        realm: 'branch',
        marketId,
        branchId,
      });
    } else {
      return await this.tokensRepo.createRefreshToken({
        userId,
        realm,
      });
    }
  }

  /**
   * Get user by refresh token
   *
   * Workflow:
   * 1. Validate refresh token
   * 2. Retrieve user with customer data
   * 3. Return user or null if expired/invalid
   */
  async getSessionUserByRefreshToken(
    token: string,
    realm?: string
  ): Promise<ClientUserWithCustomer | null> {
    const session = await this.tokensRepo.getSessionByRefreshToken(
      token,
      realm
    );

    if (!session) {
      return null;
    }

    return await this.clientUsersRepo.getClientUserById(session.userId);
  }

  /**
   * Delete refresh token (logout)
   */
  async deleteRefreshToken(token: string): Promise<void> {
    await this.tokensRepo.deleteRefreshToken(token);
  }

  /**
   * Delete all refresh tokens for user (logout all devices)
   */
  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    await this.tokensRepo.deleteAllUserRefreshTokens(userId);
  }

  /**
   * Backward compatibility: Create session using access token
   */
  async createSession(
    userId: string,
    _ttlMs: number = 15 * 60 * 1000
  ): Promise<string> {
    const { token } = await this.createAccessToken(userId);
    return token;
  }

  /**
   * Backward compatibility: Get session user using access token
   */
  async getSessionUser(token: string): Promise<ClientUserWithCustomer | null> {
    return await this.getSessionUserByAccessToken(token);
  }

  /**
   * Backward compatibility: Delete session using access token
   */
  async deleteSession(token: string): Promise<void> {
    await this.deleteAccessToken(token);
  }

  /**
   * Verify email with token
   *
   * Workflow:
   * 1. Validate verification token
   * 2. Mark email as verified
   * 3. Clear verification token
   * 4. Return updated user
   */
  async verifyEmailWithToken(token: string): Promise<ClientUser | null> {
    return await this.clientUsersRepo.verifyEmailWithToken(token);
  }

  /**
   * Update email verification token
   * Used for sending verification emails
   */
  async updateClientUserVerificationToken(
    userId: string,
    token: string
  ): Promise<void> {
    await this.clientUsersRepo.updateClientUserVerificationToken(userId, token);
  }

  // === Repository Delegations (Simple CRUD) ===

  /**
   * Get client user by email
   */
  async getClientUserByEmail(email: string): Promise<ClientUser | null> {
    return await this.clientUsersRepo.getClientUserByEmail(email);
  }

  /**
   * Get the owner (non-sub-account) client user for a customer
   */
  async getOwnerByCustomerId(customerId: string): Promise<ClientUser | null> {
    return await this.clientUsersRepo.getOwnerByCustomerId(customerId);
  }

  /**
   * Get all client users (owner + sub-accounts) for a customer
   */
  async getClientUsersByCustomerId(customerId: string): Promise<ClientUser[]> {
    return await this.clientUsersRepo.getClientUsersByCustomerId(customerId);
  }

  /**
   * Get client user by ID with customer data
   */
  async getClientUserById(id: string): Promise<ClientUserWithCustomer | null> {
    return await this.clientUsersRepo.getClientUserById(id);
  }

  /**
   * Update client user
   */
  async updateClientUser(
    userId: string,
    updates: Partial<InsertClientUser>
  ): Promise<ClientUser | undefined> {
    return await this.clientUsersRepo.updateClientUser(userId, updates);
  }

  /**
   * Get all client users with filters (admin operation)
   */
  async getAllClientUsers(filters?: {
    role?: string;
    status?: string;
    search?: string;
  }) {
    return await this.adminAuditRepo.getAllClientUsers(filters);
  }

  /**
   * Delete client user (admin operation)
   */
  async deleteClientUser(userId: string): Promise<void> {
    return await this.clientUsersRepo.deleteClientUser(userId);
  }

  /**
   * Get audit events (admin operation)
   */
  async getAuditEvents(filters?: {
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return await this.adminAuditRepo.getAuditEvents(filters);
  }

  /**
   * Get admin customer assignments
   */
  async getAdminCustomerAssignments(adminId: string) {
    return await this.adminAuditRepo.getAdminCustomerAssignments(adminId);
  }

  /**
   * Assign admin to customer
   */
  async assignAdminToCustomer(
    adminId: string,
    customerId: string,
    marketId: string
  ) {
    return await this.adminAuditRepo.assignAdminToCustomer(
      adminId,
      customerId,
      marketId
    );
  }

  /**
   * Remove admin customer assignment
   */
  async removeAdminCustomerAssignment(adminId: string, customerId: string) {
    return await this.adminAuditRepo.removeAdminCustomerAssignment(
      adminId,
      customerId
    );
  }

  /**
   * Get all markets
   */
  async getMarkets() {
    return await this.marketsRepo.getMarkets();
  }

  // === Branch Management Delegations ===

  /**
   * Get all branches (optionally filtered by parent customer)
   */
  async getBranches(parentCustomerId?: string) {
    return await this.branchesRepo.getBranches(parentCustomerId);
  }

  /**
   * Get branches for multiple customers in batch
   */
  async getBranchesBatch(customerIds: string[]) {
    return await this.branchesRepo.getBranchesBatch(customerIds);
  }

  /**
   * Get branch by ID
   */
  async getBranch(id: string) {
    return await this.branchesRepo.getBranch(id);
  }

  /**
   * Get branch by username
   */
  async getBranchByUsername(username: string) {
    return await this.branchesRepo.getBranchByUsername(username);
  }

  /**
   * Create branch with password hashing
   */
  async createBranch(branch: BranchCreateDTO): Promise<Branch> {
    return await this.branchesRepo.createBranch(branch);
  }

  /**
   * Update branch
   */
  async updateBranch(
    id: string,
    updates: Partial<Branch>
  ): Promise<Branch | undefined> {
    return await this.branchesRepo.updateBranch(id, updates);
  }

  /**
   * Delete branch
   */
  async deleteBranch(id: string) {
    return await this.branchesRepo.deleteBranch(id);
  }

  /**
   * Update branch wallet balance
   */
  async updateBranchWallet(branchId: string, amount: number) {
    return await this.branchesRepo.updateBranchWallet(branchId, amount);
  }

  /**
   * Get branch staff
   */
  async getBranchStaff(branchId: string) {
    return await this.branchesRepo.getBranchStaff(branchId);
  }

  /**
   * Get branch staff by username
   */
  async getBranchStaffByUsername(username: string, marketId?: string) {
    return await this.branchesRepo.getBranchStaffByUsername(username, marketId);
  }

  /**
   * Create branch staff with password hashing
   */
  async createBranchStaff(staff: BranchStaffCreateDTO): Promise<BranchStaff> {
    return await this.branchesRepo.createBranchStaff(staff);
  }

  /**
   * Update branch staff
   */
  async updateBranchStaff(
    id: string,
    updates: Partial<BranchStaff>
  ): Promise<BranchStaff | undefined> {
    return await this.branchesRepo.updateBranchStaff(id, updates);
  }

  /**
   * Delete branch staff
   */
  async deleteBranchStaff(id: string) {
    return await this.branchesRepo.deleteBranchStaff(id);
  }
}

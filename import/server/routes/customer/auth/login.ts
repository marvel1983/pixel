import { Router } from 'express';
import { asyncHandler } from '../../middleware';
import { requireTurnstile } from '../../../middleware/turnstile';
import { storage } from '../../../storage.runtime';
import { log } from '../../../middleware/logging';
import { generateAccessToken } from '../../../utils/jwt';
import {
  clientRegisterSchema,
  clientLoginSchema,
  ClientUserWithCustomer,
  InsertClientUser,
} from '@shared/schema';
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  AppError,
  ConflictError,
} from '../../../middleware/errorHandler';
import { rateLimiter } from '../../../middleware/rateLimiter';
import { resolveMarketId } from '../../shared/context';
import {
  auditService,
  AuditEventType,
  AuditTargetType,
} from '../../../utils/auditService';
import { triggerCustomerRegistered } from '../../../triggers/notificationTriggers';
import {
  buildCustomerResponseData,
  recordFailedLoginAttempt,
  setMarketScopedCookies,
} from './helpers';

export function registerAuthLoginRoutes(router: Router) {
  // Customer registration
  router.post(
    '/api/client/auth/register',
    asyncHandler(async (req, res) => {
      const registrationData = clientRegisterSchema.parse(req.body);
      log.info('Customer registration request received', {
        email: registrationData.email,
      });

      const existingUser = await storage.getClientUserByEmail(
        registrationData.email
      );
      if (existingUser) {
        throw new ConflictError('Email already registered');
      }

      if (!registrationData.customerInfo) {
        log.error('CustomerInfo missing from registration data', {
          email: registrationData.email,
        });
        throw new ValidationError('Customer information is required');
      }

      log.info('Creating customer record', {
        name: registrationData.customerInfo.name,
      });

      const marketId = await resolveMarketId(req, {
        allowFallbackHeaders: true,
        required: true,
      });

      if (!marketId) {
        throw new ValidationError('Market ID could not be resolved');
      }

      const { businessDescription, salesChannel, ...restCustomerInfo } =
        registrationData.customerInfo;
      const customerData = {
        ...restCustomerInfo,
        marketId,
        status: 'pending',
        contactPerson: registrationData.customerInfo.name,
        country: registrationData.customerInfo.country,
        address: registrationData.customerInfo.address,
        city: registrationData.customerInfo.city,
        email: registrationData.customerInfo.email || registrationData.email,
        phone: registrationData.customerInfo.phone,
        description: `Sales channel: ${salesChannel}\n${businessDescription}`,
      };

      const customer = await storage.createCustomer(customerData);

      const clientUser = await storage.createClientUser({
        customerId: customer.id,
        email: registrationData.email,
        password: registrationData.password,
        status: 'pending',
        emailVerified: true,
        marketId,
        role: 'client',
        accountType: 'owner',
      } as InsertClientUser & { password: string; marketId: string });

      triggerCustomerRegistered(
        customer.id,
        customer.name,
        customer.email || '',
        marketId
      ).catch((err) =>
        log.warn('Failed to trigger customer registered notification', {
          err: err.message,
        })
      );

      log.info('Customer registration complete (pending approval)', {
        email: registrationData.email,
        customerId: customer.id,
        marketId,
      });

      res.status(201).json({
        message:
          'Registration submitted. Your account is pending approval. You will be notified once approved.',
        pending: true,
        user: {
          id: clientUser.id,
          email: clientUser.email,
          customerId: clientUser.customerId,
          marketId: clientUser.marketId,
        },
      });
    })
  );

  // Customer login
  router.post(
    '/api/client/auth/login',
    requireTurnstile,
    asyncHandler(async (req, res) => {
      const loginData = clientLoginSchema.parse(req.body);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      log.info('Customer login attempt', { email: loginData.email, clientIp });

      const rateLimit = await rateLimiter.checkRateLimit(
        clientIp,
        loginData.email
      );
      if (!rateLimit.allowed) {
        const retryMinutes = rateLimit.retryAfter
          ? Math.ceil(rateLimit.retryAfter / 60)
          : 5;
        throw new AppError(
          `Too many failed login attempts. Please try again in ${retryMinutes} minutes.`,
          429,
          true,
          'RATE_LIMIT_EXCEEDED'
        );
      }

      const existingUser = await storage.getClientUserByEmail(loginData.email);
      log.info('Client user lookup result', {
        email: loginData.email,
        found: !!existingUser,
      });

      const clientUser = await storage.authenticateClientUser(
        loginData.email,
        loginData.password
      );
      log.info('Customer authentication result', {
        email: loginData.email,
        success: !!clientUser,
      });

      if (!clientUser) {
        const marketId = await resolveMarketId(req, {
          allowFallbackHeaders: true,
          required: false,
        });
        await recordFailedLoginAttempt(
          clientIp,
          loginData.email,
          existingUser?.id || undefined,
          marketId,
          req.get('user-agent')
        );
        throw new UnauthorizedError('Invalid email or password');
      }

      if (!clientUser.emailVerified) {
        throw new ForbiddenError(
          'Please verify your email address. Check your inbox for the verification link'
        );
      }

      await rateLimiter.resetLoginAttempts(clientIp, loginData.email);

      const marketId =
        clientUser.marketId ||
        (clientUser as ClientUserWithCustomer).customer?.marketId;
      if (!marketId) {
        log.warn('Login blocked - user missing market assignment', {
          userId: clientUser.id,
          email: clientUser.email,
        });
        throw new ForbiddenError(
          'User account missing market assignment - please contact support'
        );
      }

      const fullClientUser = await storage.getClientUserById(clientUser.id);
      if (
        fullClientUser &&
        (fullClientUser as unknown as { twoFactorEnabled?: boolean })
          .twoFactorEnabled
      ) {
        log.info('Customer 2FA required for login', {
          userId: clientUser.id,
          email: clientUser.email,
        });
        res.json({
          requires2FA: true,
          userId: clientUser.id,
          marketId,
          message: 'Two-factor authentication required',
        });
        return;
      }

      const accessToken = generateAccessToken({
        userId: clientUser.id,
        email: clientUser.email,
        role: clientUser.role,
        realm: 'customer',
        marketId,
        permissions: clientUser.permissions ?? [],
        customerId: clientUser.customerId,
        accountType: clientUser.accountType ?? 'owner',
      });
      const refreshToken = await storage.createRefreshToken(
        clientUser.id,
        'customer'
      );

      setMarketScopedCookies(res, marketId, accessToken, refreshToken.token);

      let customerData;
      if (clientUser.customerId) {
        customerData = await storage.getCustomer(
          clientUser.customerId,
          marketId
        );
      }

      await auditService.logEvent({
        marketId,
        userId: clientUser.id,
        eventType: AuditEventType.USER_LOGIN,
        targetType: AuditTargetType.USER,
        targetId: clientUser.id,
        details: {
          email: clientUser.email,
          customerId: clientUser.customerId,
          customerName: customerData?.name,
          loginMethod: 'email_password',
          portal: 'customer',
        },
        ipAddress: clientIp,
        userAgent: req.get('user-agent'),
      });

      res.json({
        message: 'Login successful',
        user: {
          id: clientUser.id,
          email: clientUser.email,
          customerId: clientUser.customerId,
          marketId: clientUser.marketId,
          emailVerified: clientUser.emailVerified,
          accountType: clientUser.accountType ?? 'owner',
          customer: customerData
            ? buildCustomerResponseData(customerData)
            : undefined,
        },
      });
    })
  );
}

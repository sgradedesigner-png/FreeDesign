import CircuitBreaker from 'opossum';
import { qpayService } from './qpay.service';
import { logCircuitBreaker, logQPay } from '../lib/logger';

/**
 * QPay Circuit Breaker Service
 *
 * Wraps QPay service methods with circuit breakers to prevent cascading failures
 * when QPay service is down or slow.
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests
 */

// Circuit breaker options
const circuitBreakerOptions = {
  timeout: 30000,                 // 30 seconds - if request takes longer, considered failure
  errorThresholdPercentage: 50,   // 50% error rate triggers circuit open
  resetTimeout: 30000,            // 30 seconds - how long to wait before trying again
  rollingCountTimeout: 10000,     // 10 seconds - time window for counting errors
  rollingCountBuckets: 10,        // Number of buckets in the rolling window
  volumeThreshold: 5,             // Minimum requests before circuit can open
  name: 'qpay-service'
};

/**
 * Create Invoice Circuit Breaker
 */
const createInvoiceBreaker = new CircuitBreaker(
  async (params: any) => {
    return await qpayService.createInvoice(params);
  },
  {
    ...circuitBreakerOptions,
    name: 'qpay-create-invoice'
  }
);

/**
 * Check Payment Circuit Breaker
 */
const checkPaymentBreaker = new CircuitBreaker(
  async (invoiceId: string) => {
    return await qpayService.checkPayment(invoiceId);
  },
  {
    ...circuitBreakerOptions,
    name: 'qpay-check-payment'
  }
);

/**
 * Get Payment Circuit Breaker
 */
const getPaymentBreaker = new CircuitBreaker(
  async (paymentId: string) => {
    return await qpayService.getPayment(paymentId);
  },
  {
    ...circuitBreakerOptions,
    name: 'qpay-get-payment'
  }
);

/**
 * Cancel Invoice Circuit Breaker
 */
const cancelInvoiceBreaker = new CircuitBreaker(
  async (invoiceId: string) => {
    return await qpayService.cancelInvoice(invoiceId);
  },
  {
    ...circuitBreakerOptions,
    timeout: 10000, // Shorter timeout for cancel operations
    name: 'qpay-cancel-invoice'
  }
);

// ==================== Event Listeners ====================

// Create Invoice Events
createInvoiceBreaker.on('open', () => {
  logCircuitBreaker('CREATE INVOICE', 'OPEN', { service: 'QPay' });
});

createInvoiceBreaker.on('halfOpen', () => {
  logCircuitBreaker('CREATE INVOICE', 'HALF_OPEN', { service: 'QPay', status: 'Testing recovery' });
});

createInvoiceBreaker.on('close', () => {
  logCircuitBreaker('CREATE INVOICE', 'CLOSED', { service: 'QPay', status: 'Service recovered' });
});

createInvoiceBreaker.on('failure', (error: any) => {
  logQPay('CREATE INVOICE', undefined, false, error);
});

createInvoiceBreaker.on('success', () => {
  logQPay('CREATE INVOICE', undefined, true);
});

createInvoiceBreaker.on('timeout', () => {
  logQPay('CREATE INVOICE timeout', undefined, false, { message: 'Request exceeded 30s' });
});

createInvoiceBreaker.on('reject', () => {
  logCircuitBreaker('CREATE INVOICE', 'OPEN', { service: 'QPay', reason: 'Request rejected' });
});

// Check Payment Events
checkPaymentBreaker.on('open', () => {
  logCircuitBreaker('CHECK PAYMENT', 'OPEN', { service: 'QPay' });
});

checkPaymentBreaker.on('halfOpen', () => {
  logCircuitBreaker('CHECK PAYMENT', 'HALF_OPEN', { service: 'QPay' });
});

checkPaymentBreaker.on('close', () => {
  logCircuitBreaker('CHECK PAYMENT', 'CLOSED', { service: 'QPay' });
});

// Get Payment Events
getPaymentBreaker.on('open', () => {
  logCircuitBreaker('GET PAYMENT', 'OPEN', { service: 'QPay' });
});

getPaymentBreaker.on('halfOpen', () => {
  logCircuitBreaker('GET PAYMENT', 'HALF_OPEN', { service: 'QPay' });
});

getPaymentBreaker.on('close', () => {
  logCircuitBreaker('GET PAYMENT', 'CLOSED', { service: 'QPay' });
});

// Cancel Invoice Events
cancelInvoiceBreaker.on('open', () => {
  logCircuitBreaker('CANCEL INVOICE', 'OPEN', { service: 'QPay' });
});

// ==================== Wrapped Service ====================

/**
 * QPay Service with Circuit Breakers
 *
 * Use this instead of direct qpayService for protected operations
 */
export const qpayCircuitBreaker = {
  /**
   * Create QPay Invoice with Circuit Breaker
   *
   * @throws {Error} If circuit is OPEN or request fails
   */
  async createInvoice(params: {
    orderNumber: string;
    amount: number;
    description: string;
    callbackUrl: string;
  }) {
    try {
      return await createInvoiceBreaker.fire(params);
    } catch (error: any) {
      // Check if circuit is open
      if (error.message === 'Breaker is open') {
        const err = new Error('QPay service is temporarily unavailable. Please try again later.');
        (err as any).code = 'CIRCUIT_OPEN';
        (err as any).statusCode = 503;
        throw err;
      }

      // Check if timeout
      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        const err = new Error('QPay service timeout. Please try again.');
        (err as any).code = 'TIMEOUT';
        (err as any).statusCode = 504;
        throw err;
      }

      // Re-throw original error
      throw error;
    }
  },

  /**
   * Check Payment Status with Circuit Breaker
   */
  async checkPayment(invoiceId: string) {
    try {
      return await checkPaymentBreaker.fire(invoiceId);
    } catch (error: any) {
      if (error.message === 'Breaker is open') {
        const err = new Error('QPay payment check temporarily unavailable.');
        (err as any).code = 'CIRCUIT_OPEN';
        (err as any).statusCode = 503;
        throw err;
      }
      throw error;
    }
  },

  /**
   * Get Payment Details with Circuit Breaker
   */
  async getPayment(paymentId: string) {
    try {
      return await getPaymentBreaker.fire(paymentId);
    } catch (error: any) {
      if (error.message === 'Breaker is open') {
        const err = new Error('QPay payment retrieval temporarily unavailable.');
        (err as any).code = 'CIRCUIT_OPEN';
        (err as any).statusCode = 503;
        throw err;
      }
      throw error;
    }
  },

  /**
   * Cancel Invoice with Circuit Breaker
   */
  async cancelInvoice(invoiceId: string) {
    try {
      return await cancelInvoiceBreaker.fire(invoiceId);
    } catch (error: any) {
      if (error.message === 'Breaker is open') {
        // For cancel operations, we can be more lenient
        logCircuitBreaker('CANCEL INVOICE', 'OPEN', {
          service: 'QPay',
          invoiceId,
          action: 'Skipping cancellation'
        });
        return; // Don't throw error, just skip
      }
      throw error;
    }
  },

  /**
   * Cancel Invoice with Timeout (no circuit breaker)
   * Used for background cleanup, failures are acceptable
   */
  async cancelInvoiceWithTimeout(invoiceId: string, timeoutMs: number = 5000) {
    return await qpayService.cancelInvoiceWithTimeout(invoiceId, timeoutMs);
  },

  /**
   * Get Circuit Breaker Stats
   * Useful for monitoring and health checks
   */
  getStats() {
    return {
      createInvoice: {
        name: createInvoiceBreaker.name,
        state: createInvoiceBreaker.opened ? 'OPEN' :
               createInvoiceBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: createInvoiceBreaker.stats
      },
      checkPayment: {
        name: checkPaymentBreaker.name,
        state: checkPaymentBreaker.opened ? 'OPEN' :
               checkPaymentBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: checkPaymentBreaker.stats
      },
      getPayment: {
        name: getPaymentBreaker.name,
        state: getPaymentBreaker.opened ? 'OPEN' :
               getPaymentBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: getPaymentBreaker.stats
      },
      cancelInvoice: {
        name: cancelInvoiceBreaker.name,
        state: cancelInvoiceBreaker.opened ? 'OPEN' :
               cancelInvoiceBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
        stats: cancelInvoiceBreaker.stats
      }
    };
  },

  /**
   * Check if any circuit is open
   */
  isAnyCircuitOpen(): boolean {
    return createInvoiceBreaker.opened ||
           checkPaymentBreaker.opened ||
           getPaymentBreaker.opened ||
           cancelInvoiceBreaker.opened;
  }
};

/**
 * Export individual breakers for advanced usage
 */
export const circuitBreakers = {
  createInvoice: createInvoiceBreaker,
  checkPayment: checkPaymentBreaker,
  getPayment: getPaymentBreaker,
  cancelInvoice: cancelInvoiceBreaker
};

import axios, { AxiosInstance } from 'axios'
import https from 'https'

interface QPayConfig {
  baseURL: string
  username: string
  password: string
  invoiceCode: string
  requestTimeoutMs: number
  invoiceMaxRetries: number
}

interface QPayTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface QPayInvoiceRequest {
  invoice_code: string
  sender_invoice_no: string
  invoice_receiver_code: string
  invoice_description: string
  amount: number
  callback_url: string
  sender_branch_code?: string
  lines?: any[] // For detailed line items
}

interface QPayInvoiceResponse {
  invoice_id: string
  qr_text: string
  qr_image: string
  qPay_shortUrl: string
  urls: Array<{
    name: string
    description: string
    logo: string
    link: string
  }>
}

interface QPayPaymentCheckRequest {
  object_type: 'INVOICE'
  object_id: string
  offset: {
    page_number: number
    page_limit: number
  }
}

interface QPayPaymentCheckResponse {
  count: number
  paid_amount: number
  rows: Array<{
    payment_id: string
    payment_status: string
    payment_amount: number
    payment_date: string
    customer_name: string
    payment_wallet: string
  }>
}

export class QPayService {
  private client: AxiosInstance
  private config: QPayConfig
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: Date | null = null
  private mockMode: boolean = false

  constructor() {
    // Enable mock mode if QPAY_MOCK_MODE=true in .env
    this.mockMode = process.env.QPAY_MOCK_MODE === 'true'

    if (this.mockMode) {
      console.log('[MOCK] QPay Mock Mode Enabled - Using fake payment responses')
    }

    const rawBaseUrl = process.env.QPAY_BASE_URL || ''
    const normalizedBaseUrl = rawBaseUrl
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/v2$/i, '')

    this.config = {
      baseURL: normalizedBaseUrl,
      username: process.env.QPAY_USERNAME || '',
      password: process.env.QPAY_PASSWORD || '',
      invoiceCode: process.env.QPAY_INVOICE_CODE || '',
      requestTimeoutMs: Number(process.env.QPAY_REQUEST_TIMEOUT_MS || 45000),
      invoiceMaxRetries: Math.max(1, Number(process.env.QPAY_INVOICE_MAX_RETRIES || 3))
    }

    console.log('[QPay Config]', {
      baseURL: this.config.baseURL,
      username: this.config.username,
      invoiceCode: this.config.invoiceCode,
      mockMode: this.mockMode,
      requestTimeoutMs: this.config.requestTimeoutMs,
      invoiceMaxRetries: this.config.invoiceMaxRetries,
      callbackUrl: process.env.QPAY_CALLBACK_URL || ''
    })

    // Create HTTPS agent for better SSL/TLS handling
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Accept self-signed certificates
      keepAlive: true,
      keepAliveMsecs: 1000,
      timeout: 60000,
      // Force TLS 1.2+
      minVersion: 'TLSv1.2',
      maxSockets: 10,
      maxFreeSockets: 5
    })

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.requestTimeoutMs,
      httpsAgent: httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QPay-Node-Client'
      },
      // Disable proxy to avoid connection issues
      proxy: false,
      // Force IPv4 to avoid IPv6 connection delays
      family: 4,
      // Increase max redirects
      maxRedirects: 5,
      // Decompress response
      decompress: true,
      // Validate status
      validateStatus: (status) => status >= 200 && status < 500
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      // Skip auth for token endpoint
      if (config.url?.includes('/auth/token')) {
        console.log(`[QPay Request] ${config.method?.toUpperCase()} ${config.url} (no auth)`)
        return config
      }

      // Ensure we have a valid token
      await this.ensureValidToken()

      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }

      console.log(`[QPay Request] ${config.method?.toUpperCase()} ${config.url} (with Bearer token)`)
      console.log(`[QPay Request Body]`, JSON.stringify(config.data).substring(0, 200))

      return config
    })

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[QPay Response] ${response.status} ${response.config.url} (${(response.headers['content-length'] || '0')} bytes)`)
        return response
      },
      async (error) => {
        const originalRequest = error.config
        console.log(`[QPay Error] ${error.code || error.message} on ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`)

        // If 401 and haven't retried yet, refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await this.refreshAccessToken()
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
            return this.client(originalRequest)
          } catch (refreshError) {
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private isSandboxLikeConfig(): boolean {
    return (
      this.config.baseURL.includes('sandbox') ||
      this.config.username.toUpperCase().includes('TEST') ||
      this.config.invoiceCode.toUpperCase().includes('TEST')
    )
  }

  private formatAxiosError(error: any): string {
    const status = error?.response?.status
    const data = error?.response?.data
    const url = error?.config?.url
    const method = String(error?.config?.method || '').toUpperCase()
    const baseURL = error?.config?.baseURL || this.config.baseURL
    const message = error?.message || 'Unknown error'

    const dataText =
      typeof data === 'string'
        ? data.slice(0, 300)
        : data
          ? JSON.stringify(data).slice(0, 300)
          : ''

    return `[${method}] ${baseURL}${url || ''} status=${status || 'N/A'} message=${message}${dataText ? ` data=${dataText}` : ''}`
  }

  private isRetryableAxiosError(error: any): boolean {
    const status = Number(error?.response?.status || 0)
    const code = String(error?.code || '')
    const message = String(error?.message || '').toLowerCase()

    if (status >= 500) return true
    if (status === 429) return true

    if (
      code === 'ECONNABORTED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND'
    ) {
      return true
    }

    if (
      message.includes('timeout') ||
      message.includes('socket hang up') ||
      message.includes('network error')
    ) {
      return true
    }

    return false
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get access token from QPay
   */
  private async getToken(): Promise<void> {
    try {
      const response = await this.client.post<QPayTokenResponse>(
        '/v2/auth/token',
        {},
        {
          auth: {
            username: this.config.username,
            password: this.config.password
          }
        }
      )

      this.accessToken = response.data.access_token
      this.refreshToken = response.data.refresh_token

      // Set token expiry (expires_in is in seconds)
      const expiresIn = response.data.expires_in || 3600
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

      console.log('[OK] QPay token obtained successfully')
    } catch (error) {
      console.error('[ERROR] Failed to get QPay token:', error)
      throw new Error('QPay authentication failed')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      return this.getToken()
    }

    try {
      const response = await this.client.post<QPayTokenResponse>(
        '/v2/auth/refresh',
        {},
        {
          headers: {
            Authorization: `Bearer ${this.refreshToken}`
          }
        }
      )

      this.accessToken = response.data.access_token
      this.refreshToken = response.data.refresh_token

      const expiresIn = response.data.expires_in || 3600
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

      console.log('[OK] QPay token refreshed successfully')
    } catch (error) {
      console.error('[ERROR] Failed to refresh token, getting new one:', error)
      await this.getToken()
    }
  }

  /**
   * Ensure we have a valid token before making requests
   */
  private async ensureValidToken(): Promise<void> {
    // If no token or token expired, get new one
    if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.getToken()
    }
  }

  /**
   * Create QPay invoice (simple mode)
   */
  async createInvoice(params: {
    orderNumber: string
    amount: number
    description: string
    callbackUrl?: string
  }): Promise<QPayInvoiceResponse> {
    // MOCK MODE: Return fake invoice data
    if (this.mockMode) {
      const mockInvoiceId = `MOCK_INV_${Date.now()}`
      // Simple mock QR code (200x200 black square with white border - represents a real QR)
      const mockQrImage = 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="white"/>
          <rect x="10" y="10" width="180" height="180" fill="black"/>
          <rect x="20" y="20" width="40" height="40" fill="white"/>
          <rect x="140" y="20" width="40" height="40" fill="white"/>
          <rect x="20" y="140" width="40" height="40" fill="white"/>
          <text x="100" y="105" font-size="12" fill="white" text-anchor="middle">MOCK QR</text>
          <text x="100" y="120" font-size="10" fill="white" text-anchor="middle">${params.amount} MNT</text>
        </svg>
      `).toString('base64')

      const mockResponse: QPayInvoiceResponse = {
        invoice_id: mockInvoiceId,
        qr_text: `https://qpay.mn/invoice/${mockInvoiceId}`,
        qr_image: mockQrImage,
        qPay_shortUrl: `https://qpay.mn/i/${mockInvoiceId}`,
        urls: [
          {
            name: 'Khan Bank',
            description: 'Khan Bank',
            logo: 'https://cdn.qpay.mn/banks/khan.png',
            link: `khanbank://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'TDB',
            description: 'Trade and Development Bank',
            logo: 'https://cdn.qpay.mn/banks/tdb.png',
            link: `tdb://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'Golomt Bank',
            description: 'Golomt Bank',
            logo: 'https://cdn.qpay.mn/banks/golomt.png',
            link: `golomt://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'Most Money',
            description: 'Most Money',
            logo: 'https://cdn.qpay.mn/banks/most.png',
            link: `most://qpay?invoice=${mockInvoiceId}`
          }
        ]
      }

      console.log(`[MOCK] Mock QPay invoice created: ${mockInvoiceId} for order ${params.orderNumber}`)
      return mockResponse
    }

    // REAL MODE: Make actual API call
    try {
      const invoiceRequest: QPayInvoiceRequest = {
        invoice_code: this.config.invoiceCode,
        sender_invoice_no: params.orderNumber,
        invoice_receiver_code: 'terminal', // Generic customer
        invoice_description: params.description,
        amount: params.amount,
        callback_url: params.callbackUrl || process.env.QPAY_CALLBACK_URL || ''
      }

      if (/localhost|127\.0\.0\.1/i.test(invoiceRequest.callback_url)) {
        console.warn(
          '[WARN] QPAY_CALLBACK_URL points to localhost. QPay sandbox may reject invoice or fail callback. Use ngrok/public HTTPS callback URL.'
        )
      }

      const primaryEndpoint = '/v2/invoice'
      const fallbackEndpoint = '/v2/invoice/test'
      let lastError: any = null

      for (let attempt = 1; attempt <= this.config.invoiceMaxRetries; attempt++) {
        try {
          const response = await this.client.post<QPayInvoiceResponse>(
            primaryEndpoint,
            invoiceRequest
          )

          console.log('[OK] QPay invoice created:', response.data.invoice_id)
          return response.data
        } catch (primaryError: any) {
          let candidateError: any = primaryError
          const status = primaryError?.response?.status
          const shouldTrySandboxFallback =
            status === 404 && this.isSandboxLikeConfig()

          if (shouldTrySandboxFallback) {
            console.warn(
              `[WARN] Primary invoice endpoint returned 404. Retrying with fallback endpoint: ${fallbackEndpoint}`
            )

            try {
              const fallbackResponse = await this.client.post<QPayInvoiceResponse>(
                fallbackEndpoint,
                invoiceRequest
              )

              console.log('[OK] QPay invoice created via fallback endpoint:', fallbackResponse.data.invoice_id)
              return fallbackResponse.data
            } catch (fallbackError: any) {
              candidateError = fallbackError
            }
          }

          lastError = candidateError
          const canRetry = attempt < this.config.invoiceMaxRetries && this.isRetryableAxiosError(candidateError)
          if (!canRetry) {
            throw candidateError
          }

          const backoffMs = 1000 * attempt
          console.warn(
            `[WARN] QPay invoice create retry ${attempt}/${this.config.invoiceMaxRetries - 1} after ${backoffMs}ms: ${this.formatAxiosError(candidateError)}`
          )
          await this.sleep(backoffMs)
        }
      }

      if (lastError) {
        throw lastError
      }

      throw new Error('Unknown invoice creation error')
    } catch (error: any) {
      console.error('[ERROR] Failed to create QPay invoice:', this.formatAxiosError(error))
      throw new Error('Failed to create payment invoice')
    }
  }

  /**
   * Create detailed invoice with line items (for ebarimt integration)
   */
  async createDetailedInvoice(params: {
    orderNumber: string
    amount: number
    description: string
    customerInfo?: {
      register?: string
      name?: string
      email?: string
      phone?: string
    }
    lineItems: Array<{
      description: string
      quantity: number
      unitPrice: number
      taxProductCode?: string
    }>
    callbackUrl?: string
  }): Promise<QPayInvoiceResponse> {
    try {
      const lines = params.lineItems.map(item => ({
        tax_product_code: item.taxProductCode || '6401',
        line_description: item.description,
        line_quantity: item.quantity.toString(),
        line_unit_price: item.unitPrice.toString(),
        note: '-',
        discounts: [],
        surcharges: [],
        taxes: []
      }))

      const invoiceRequest = {
        invoice_code: this.config.invoiceCode,
        sender_invoice_no: params.orderNumber,
        invoice_receiver_code: params.customerInfo?.register ? '83' : 'terminal',
        invoice_description: params.description,
        amount: params.amount,
        callback_url: params.callbackUrl || process.env.QPAY_CALLBACK_URL || '',
        enable_expiry: 'true',  // Phase 1: Enable 48-hour expiration
        expiry_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
        allow_partial: false,
        allow_exceed: false,
        invoice_receiver_data: params.customerInfo || {},
        lines
      }

      if (/localhost|127\.0\.0\.1/i.test(invoiceRequest.callback_url)) {
        console.warn(
          '[WARN] QPAY_CALLBACK_URL points to localhost. QPay sandbox may reject invoice or fail callback. Use ngrok/public HTTPS callback URL.'
        )
      }

      const primaryEndpoint = '/v2/invoice'

      try {
        const response = await this.client.post<QPayInvoiceResponse>(
          primaryEndpoint,
          invoiceRequest
        )

        console.log('[OK] QPay detailed invoice created:', response.data.invoice_id)
        return response.data
      } catch (primaryError: any) {
        const status = primaryError?.response?.status
        const shouldTrySandboxFallback =
          status === 404 && this.isSandboxLikeConfig()

        if (!shouldTrySandboxFallback) {
          throw primaryError
        }

        const fallbackEndpoint = '/v2/invoice/test'
        console.warn(
          `[WARN] Primary detailed invoice endpoint returned 404. Retrying with fallback endpoint: ${fallbackEndpoint}`
        )

        const fallbackResponse = await this.client.post<QPayInvoiceResponse>(
          fallbackEndpoint,
          invoiceRequest
        )

        console.log('[OK] QPay detailed invoice created via fallback endpoint:', fallbackResponse.data.invoice_id)
        return fallbackResponse.data
      }
    } catch (error: any) {
      console.error('[ERROR] Failed to create detailed invoice:', this.formatAxiosError(error))
      throw new Error('Failed to create payment invoice')
    }
  }

  /**
   * Check if invoice has been paid
   */
  async checkPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
    // MOCK MODE: Simulate payment after 30 seconds
    if (this.mockMode) {
      // Extract timestamp from mock invoice ID
      const timestampMatch = invoiceId.match(/MOCK_INV_(\d+)/)
      if (timestampMatch) {
        const invoiceTimestamp = parseInt(timestampMatch[1])
        const now = Date.now()
        const elapsed = now - invoiceTimestamp

        // After 30 seconds, simulate successful payment
        if (elapsed > 30000) {
          const mockPaymentId = `MOCK_PAY_${Date.now()}`
          console.log(`[MOCK] Mock payment PAID for invoice ${invoiceId}`)

          return {
            count: 1,
            paid_amount: 100000, // Mock amount
            rows: [
              {
                payment_id: mockPaymentId,
                payment_status: 'PAID',
                payment_amount: 100000,
                payment_date: new Date().toISOString(),
                customer_name: 'Test Customer',
                payment_wallet: 'Khan Bank'
              }
            ]
          }
        }
      }

      // Still waiting for payment
      console.log(`[MOCK] Mock payment UNPAID for invoice ${invoiceId}`)
      return {
        count: 0,
        paid_amount: 0,
        rows: []
      }
    }

    // REAL MODE: Make actual API call
    try {
      const request: QPayPaymentCheckRequest = {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: {
          page_number: 1,
          page_limit: 100
        }
      }

      const response = await this.client.post<QPayPaymentCheckResponse>(
        '/v2/payment/check',
        request
      )

      return response.data
    } catch (error: any) {
      console.error('[ERROR] Failed to check payment:', this.formatAxiosError(error))
      throw new Error('Failed to check payment status')
    }
  }

  /**
   * Get payment details by payment ID
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/payment/${paymentId}`)
      return response.data
    } catch (error: any) {
      console.error('[ERROR] Failed to get payment:', this.formatAxiosError(error))
      throw new Error('Failed to get payment details')
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/invoice/${invoiceId}`)
      console.log('[OK] Invoice cancelled:', invoiceId)
    } catch (error: any) {
      console.error('[ERROR] Failed to cancel invoice:', this.formatAxiosError(error))
      throw new Error('Failed to cancel invoice')
    }
  }

  /**
   * Cancel invoice with timeout (best-effort wrapper)
   */
  async cancelInvoiceWithTimeout(invoiceId: string, timeoutMs: number = 5000): Promise<void> {
    const startedAt = Date.now()
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`cancel timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      console.log(`[QPay Cancel] start invoiceId=${invoiceId} timeoutMs=${timeoutMs}`)
      await Promise.race([this.cancelInvoice(invoiceId), timeoutPromise])
      console.log(`[QPay Cancel] success invoiceId=${invoiceId} elapsedMs=${Date.now() - startedAt}`)
    } catch (error: any) {
      console.warn(
        `[QPay Cancel] failed invoiceId=${invoiceId} elapsedMs=${Date.now() - startedAt} reason=${error?.message || 'unknown'}`
      )
      throw error
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string): Promise<void> {
    try {
      // QPay V2 docs show this endpoint as GET.
      await this.client.get(`/v2/payment/refund/${paymentId}`)
      console.log('[OK] Payment refunded:', paymentId)
    } catch (error: any) {
      console.error('[ERROR] Failed to refund payment:', this.formatAxiosError(error))
      throw new Error('Failed to refund payment')
    }
  }

  /**
   * Create electronic receipt (ebarimt)
   */
  async createEbarimt(paymentId: string, receiverType: 'CITIZEN' | 'ORGANIZATION' = 'CITIZEN'): Promise<any> {
    try {
      const response = await this.client.post('/v2/ebarimt/create', {
        payment_id: paymentId,
        ebarimt_receiver_type: receiverType
      })

      console.log('[OK] Ebarimt created for payment:', paymentId)
      return response.data
    } catch (error: any) {
      console.error('[ERROR] Failed to create ebarimt:', this.formatAxiosError(error))
      throw new Error('Failed to create electronic receipt')
    }
  }
}

// Export singleton instance
export const qpayService = new QPayService()



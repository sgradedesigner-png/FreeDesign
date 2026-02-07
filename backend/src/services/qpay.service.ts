import axios, { AxiosInstance } from 'axios'

interface QPayConfig {
  baseURL: string
  username: string
  password: string
  invoiceCode: string
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
      console.log('🧪 QPay Mock Mode Enabled - Using fake payment responses')
    }

    this.config = {
      baseURL: process.env.QPAY_BASE_URL || '',
      username: process.env.QPAY_USERNAME || '',
      password: process.env.QPAY_PASSWORD || '',
      invoiceCode: process.env.QPAY_INVOICE_CODE || ''
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      // Skip auth for token endpoint
      if (config.url?.includes('/auth/token')) {
        return config
      }

      // Ensure we have a valid token
      await this.ensureValidToken()

      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }

      return config
    })

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

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

      console.log('✅ QPay token obtained successfully')
    } catch (error) {
      console.error('❌ Failed to get QPay token:', error)
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

      console.log('✅ QPay token refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh token, getting new one:', error)
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
          <text x="100" y="120" font-size="10" fill="white" text-anchor="middle">${params.amount}₮</text>
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
            description: 'Хаан банк',
            logo: 'https://cdn.qpay.mn/banks/khan.png',
            link: `khanbank://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'TDB',
            description: 'Худалдаа хөгжлийн банк',
            logo: 'https://cdn.qpay.mn/banks/tdb.png',
            link: `tdb://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'Golomt Bank',
            description: 'Голомт банк',
            logo: 'https://cdn.qpay.mn/banks/golomt.png',
            link: `golomt://qpay?invoice=${mockInvoiceId}`
          },
          {
            name: 'Most Money',
            description: 'Мост мани',
            logo: 'https://cdn.qpay.mn/banks/most.png',
            link: `most://qpay?invoice=${mockInvoiceId}`
          }
        ]
      }

      console.log(`🧪 Mock QPay invoice created: ${mockInvoiceId} for order ${params.orderNumber}`)
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
        callback_url: params.callbackUrl || process.env.QPAY_CALLBACK_URL || '',
        sender_branch_code: 'ONLINE'
      }

      const response = await this.client.post<QPayInvoiceResponse>(
        '/v2/invoice',
        invoiceRequest
      )

      console.log('✅ QPay invoice created:', response.data.invoice_id)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create QPay invoice:', error.response?.data || error.message)
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
        sender_branch_code: 'ONLINE',
        enable_expiry: 'false',
        allow_partial: false,
        allow_exceed: false,
        invoice_receiver_data: params.customerInfo || {},
        lines
      }

      const response = await this.client.post<QPayInvoiceResponse>(
        '/v2/invoice',
        invoiceRequest
      )

      console.log('✅ QPay detailed invoice created:', response.data.invoice_id)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create detailed invoice:', error.response?.data || error.message)
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
          console.log(`🧪 Mock payment PAID for invoice ${invoiceId}`)

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
      console.log(`🧪 Mock payment UNPAID for invoice ${invoiceId}`)
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
      console.error('❌ Failed to check payment:', error.response?.data || error.message)
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
      console.error('❌ Failed to get payment:', error.response?.data || error.message)
      throw new Error('Failed to get payment details')
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/invoice/${invoiceId}`)
      console.log('✅ Invoice cancelled:', invoiceId)
    } catch (error: any) {
      console.error('❌ Failed to cancel invoice:', error.response?.data || error.message)
      throw new Error('Failed to cancel invoice')
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/payment/refund/${paymentId}`)
      console.log('✅ Payment refunded:', paymentId)
    } catch (error: any) {
      console.error('❌ Failed to refund payment:', error.response?.data || error.message)
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

      console.log('✅ Ebarimt created for payment:', paymentId)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create ebarimt:', error.response?.data || error.message)
      throw new Error('Failed to create electronic receipt')
    }
  }
}

// Export singleton instance
export const qpayService = new QPayService()

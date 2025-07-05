import * as paypal from '@paypal/checkout-server-sdk';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaypalService {
  private client: paypal.core.PayPalHttpClient;

  constructor(private configService: ConfigService) {
    const clientId = 'AQ2DyWK8hB66bbRbWK5gc61IxetlZF5dK55Q69jCjNSuRN9JBTTGsvzLJLrEuCbIg_e3if3DLxzRD8id';
    const clientSecret = 'EA3wZ1YBH-B-3oIThA0Yxd0ZOCjxcaWS2_K8a3aYFw7TLBtZlV_MVt0bhMH1pkVzFoF3csSBUVcHGSpO';
    const baseApiUrl = 'https://api-m.sandbox.paypal.com';
    if (!clientId || !clientSecret || !baseApiUrl) {
      throw new Error('PayPal environment variables are missing');
    }

    const environment =
      baseApiUrl.includes('sandbox')
        ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
        : new paypal.core.LiveEnvironment(clientId, clientSecret);

    this.client = new paypal.core.PayPalHttpClient(environment);
  }

  async createPayment(orderData: any): Promise<any> {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody(orderData);

    try {
      const response = await this.client.execute(request);
      return response.result;
    } catch (error) {
      console.error('❌ Error creating PayPal payment:', error);
      throw new InternalServerErrorException('PayPal payment creation failed.');
    }
  }

  async capturePayment(orderId: string): Promise<any> {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    try {
      const response = await this.client.execute(request);
      return response.result;
    } catch (error) {
      console.error('❌ Error capturing PayPal payment:', error);
      throw new InternalServerErrorException('Failed to capture PayPal payment.');
    }
  }
}
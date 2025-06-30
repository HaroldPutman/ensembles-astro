import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const paypalClientId = import.meta.env.PAYPAL_CLIENT_ID;

    if (!paypalClientId) {
      return new Response(
        JSON.stringify({
          message: 'PayPal configuration not found',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        clientId: paypalClientId,
        currency: 'USD',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error getting PayPal config:', error);
    return new Response(
      JSON.stringify({
        message: 'Failed to get PayPal configuration',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

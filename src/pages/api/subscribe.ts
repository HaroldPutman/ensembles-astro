import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let email;
  try {
    const body = await request.json();
    email = body.email;
  } catch (e) {
    return new Response(
      JSON.stringify({
        message: 'Invalid JSON in request body',
      }),
      { status: 400 }
    );
  }

  if (!email) {
    return new Response(
      JSON.stringify({
        message: 'Email is required',
      }),
      { status: 400 }
    );
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': import.meta.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [3], // newsletter list id
        updateEnabled: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to subscribe');
    }

    return new Response(
      JSON.stringify({
        message: 'Successfully subscribed to newsletter',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : 'Failed to subscribe to newsletter',
      }),
      { status: 500 }
    );
  }
}; 
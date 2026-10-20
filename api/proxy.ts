export const config = {
  runtime: 'edge', // Tells Vercel to route this to the Edge Network
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const targetUrl = `https://ipai-3.inferenceport.ai${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Host', 'ipai-3.inferenceport.ai');

  let body: ReadableStream | Uint8Array | null = null;
  if (request.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    body = request.body;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      // @ts-ignore
      duplex: 'half', 
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy error connecting to upstream service.' }), 
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

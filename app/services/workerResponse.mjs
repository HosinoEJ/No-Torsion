function shouldIncludeBody(response) {
  return response.body !== null && ![101, 204, 205, 304].includes(response.status);
}

export async function rebuildResponseWithHeaders(response, headerEntries = {}) {
  const headers = new Headers(response.headers);

  Object.entries(headerEntries).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const body = shouldIncludeBody(response)
    ? await response.arrayBuffer()
    : null;

  if (body) {
    headers.set('Content-Length', String(body.byteLength));
  } else {
    headers.delete('Content-Length');
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

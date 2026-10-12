export const readBoundedText = async (response: Response, maxBytes: number): Promise<string | undefined> => {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    return;
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    received += value.byteLength;

    if (received > maxBytes) {
      await reader.cancel();
      return;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
};

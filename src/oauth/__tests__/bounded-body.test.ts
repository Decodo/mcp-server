import { readBoundedText } from '../bounded-body';

const streamOf = (chunks: string[], { endless = false, pulls = { count: 0 } } = {}) =>
  new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls.count += 1;
      const next = chunks.shift();

      if (next !== undefined) {
        controller.enqueue(new TextEncoder().encode(next));
      } else if (endless) {
        controller.enqueue(new Uint8Array(1024));
      } else {
        controller.close();
      }
    },
  });

describe('readBoundedText', () => {
  it('returns the whole body when it fits', async () => {
    await expect(readBoundedText(new Response(streamOf(['{"a":', '1}'])), 64)).resolves.toBe('{"a":1}');
  });

  it('returns an empty string for a body-less response', async () => {
    await expect(readBoundedText(new Response(null, { status: 204 }), 64)).resolves.toBe('');
  });

  it('rejects a declared length over the limit without reading', async () => {
    const response = new Response('x'.repeat(10), { headers: { 'content-length': '100000' } });

    await expect(readBoundedText(response, 64)).resolves.toBeUndefined();
  });

  it('stops reading an endless body once the limit is passed', async () => {
    const pulls = { count: 0 };

    await expect(readBoundedText(new Response(streamOf([], { endless: true, pulls })), 4096)).resolves.toBeUndefined();
    expect(pulls.count).toBeLessThan(10);
  });
});

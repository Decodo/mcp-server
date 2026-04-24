import { ProgressNotifier, ProgressExtra } from '../progress';

describe('ProgressNotifier', () => {
  describe('when progressToken is provided', () => {
    it('sends progress notification', async () => {
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
        _meta: {
          progressToken: 'token-456',
        },
      };

      const notifier = new ProgressNotifier(extra);
      await notifier.notify('Processing...', 0.5, 1);

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-456',
          progress: 0.5,
          total: 1,
          message: 'Processing...',
        },
      });
    });

    it('sends notification with default progress values', async () => {
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
        _meta: {
          progressToken: 'token-456',
        },
      };

      const notifier = new ProgressNotifier(extra);
      await notifier.notify('Starting...');

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-456',
          progress: 0,
          total: 1,
          message: 'Starting...',
        },
      });
    });

    it('schedules delayed notification', async () => {
      jest.useFakeTimers();

      const mockSendNotification = jest.fn().mockResolvedValue(undefined);
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
        _meta: {
          progressToken: 'token-456',
        },
      };

      const notifier = new ProgressNotifier(extra);
      const timeout = await notifier.notifyAfterDelay('Waiting...', 3000);

      expect(timeout).not.toBeNull();
      expect(mockSendNotification).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-456',
          progress: 0,
          total: 1,
          message: 'Waiting...',
        },
      });

      if (timeout) clearTimeout(timeout);
      jest.useRealTimers();
    });

    it('silently ignores errors from sendNotification', async () => {
      const mockSendNotification = jest.fn().mockRejectedValue(new Error('Network error'));
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
        _meta: {
          progressToken: 'token-456',
        },
      };

      const notifier = new ProgressNotifier(extra);
      
      await expect(notifier.notify('Processing...')).resolves.toBeUndefined();
    });
  });

  describe('when progressToken is NOT provided', () => {
    it('does not send notification when progressToken is missing', async () => {
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
        _meta: {},
      };

      const notifier = new ProgressNotifier(extra);
      await notifier.notify('Processing...', 0.5, 1);

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('does not send notification when _meta is missing', async () => {
      const mockSendNotification = jest.fn().mockResolvedValue(undefined);
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: mockSendNotification,
        sendRequest: jest.fn(),
      };

      const notifier = new ProgressNotifier(extra);
      await notifier.notify('Processing...', 0.5, 1);

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('does not schedule delayed notification', async () => {
      const extra: ProgressExtra = {
        signal: new AbortController().signal,
        requestId: 'req-123',
        sendNotification: jest.fn(),
        sendRequest: jest.fn(),
      };

      const notifier = new ProgressNotifier(extra);
      const timeout = await notifier.notifyAfterDelay('Waiting...', 3000);

      expect(timeout).toBeNull();
    });
  });

  describe('when extra is undefined', () => {
    it('does not throw when extra is undefined', async () => {
      const notifier = new ProgressNotifier(undefined);
      await expect(notifier.notify('Processing...')).resolves.toBeUndefined();
    });

    it('returns null for delayed notification', async () => {
      const notifier = new ProgressNotifier(undefined);
      const timeout = await notifier.notifyAfterDelay('Waiting...', 3000);
      expect(timeout).toBeNull();
    });
  });

  describe('getElapsedMs', () => {
    it('returns elapsed time since construction', async () => {
      jest.useFakeTimers();
      
      const notifier = new ProgressNotifier(undefined);
      
      expect(notifier.getElapsedMs()).toBe(0);
      
      jest.advanceTimersByTime(1500);
      expect(notifier.getElapsedMs()).toBe(1500);
      
      jest.advanceTimersByTime(500);
      expect(notifier.getElapsedMs()).toBe(2000);
      
      jest.useRealTimers();
    });
  });
});

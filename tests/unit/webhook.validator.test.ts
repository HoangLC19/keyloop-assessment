import { validateWebhookUrl } from '../../src/modules/notifications/webhook.validator';
import { ValidationError } from '../../src/shared/errors';

describe('validateWebhookUrl', () => {
  it('accepts valid HTTPS public URL', async () => {
    await expect(validateWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
  });

  it('rejects HTTP', async () => {
    await expect(validateWebhookUrl('http://example.com/hook')).rejects.toThrow(ValidationError);
  });

  it('rejects localhost', async () => {
    await expect(validateWebhookUrl('https://localhost/hook')).rejects.toThrow(ValidationError);
  });

  it('rejects 127.0.0.1', async () => {
    await expect(validateWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(ValidationError);
  });

  it('rejects RFC-1918 ranges', async () => {
    await expect(validateWebhookUrl('https://192.168.1.1/hook')).rejects.toThrow(ValidationError);
    await expect(validateWebhookUrl('https://10.0.0.1/hook')).rejects.toThrow(ValidationError);
    await expect(validateWebhookUrl('https://172.16.0.1/hook')).rejects.toThrow(ValidationError);
  });
});

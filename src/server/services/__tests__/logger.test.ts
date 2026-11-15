import { describe, it, expect, vi } from 'vitest';
import { logger } from '../logger.js';

describe('logger', () => {
  it('logs info, warn, and error without throwing', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger.info('Test info', { foo: 'bar' });
    logger.warn('Test warn');
    logger.error('Test error', { err: 'something' });

    expect(writeSpy).toHaveBeenCalledTimes(3);
    writeSpy.mockRestore();
  });
});

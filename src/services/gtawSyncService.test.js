import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncGtawAccountWithReports } from './gtawSyncService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from '@sentry/react';

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

// Mock sentry
vi.mock('@sentry/react');

describe('gtawSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call the gtawAccountSync Firebase Function and return success', async () => {
    const mockGtaUser = { username: 'testuser', id: '123' };
    const mockOptions = { dryRun: true };
    const mockSuccessResponse = { success: true, message: 'Sync successful' };

    const mockHttpsCallable = vi.fn().mockResolvedValue({ data: mockSuccessResponse });
    httpsCallable.mockReturnValue(mockHttpsCallable);

    const result = await syncGtawAccountWithReports(mockGtaUser, mockOptions);

    expect(getFunctions).toHaveBeenCalledTimes(1);
    expect(httpsCallable).toHaveBeenCalledWith(undefined, 'gtawAccountSync');
    expect(mockHttpsCallable).toHaveBeenCalledWith({ gtaUser: mockGtaUser, options: mockOptions });
    expect(result).toEqual(mockSuccessResponse);
  });

  it('should handle errors from the Firebase Function call', async () => {
    const mockGtaUser = { username: 'testuser', id: '123' };
    const mockOptions = { dryRun: false };
    const mockError = new Error('Function call failed');

    const mockHttpsCallable = vi.fn().mockRejectedValue(mockError);
    httpsCallable.mockReturnValue(mockHttpsCallable);

    const result = await syncGtawAccountWithReports(mockGtaUser, mockOptions);

    expect(getFunctions).toHaveBeenCalledTimes(1);
    expect(httpsCallable).toHaveBeenCalledWith(undefined, 'gtawAccountSync');
    expect(mockHttpsCallable).toHaveBeenCalledWith({ gtaUser: mockGtaUser, options: mockOptions });
    expect(result).toEqual({
      success: false,
      message: `Sync failed: ${mockError.message}`,
      error: mockError.message,
    });
  });

  it('should handle permission denied errors specifically', async () => {
    const mockGtaUser = { username: 'testuser', id: '123' };
    const mockOptions = {};
    const mockError = new Error('Permission denied');
    mockError.code = 'functions/permission-denied';

    const mockHttpsCallable = vi.fn().mockRejectedValue(mockError);
    httpsCallable.mockReturnValue(mockHttpsCallable);

    // Mock Sentry and window.onerror to check if they are called
    const sentrySpy = vi.spyOn(Sentry, 'captureException');
    window.onerror = vi.fn();

    const result = await syncGtawAccountWithReports(mockGtaUser, mockOptions);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Permission denied');
    
    // Verify that the specific error handler was triggered
    expect(window.onerror).toHaveBeenCalled();
    expect(sentrySpy).toHaveBeenCalled();

    sentrySpy.mockRestore();
  });
});

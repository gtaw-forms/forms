import { describe, it, expect } from 'vitest';
import {
  detectForwardedSpoof,
  getClientIp,
  isLoopbackIp,
  isTrustedProxyPeer,
  parseTrustedProxies,
} from '../discord-bot/services/clientIp.js';

const req = (peer, headers = {}) => ({ socket: { remoteAddress: peer }, headers });

describe('client IP resolution behind nginx', () => {
  it('takes X-Real-IP from a loopback proxy (nginx sets it)', () => {
    expect(getClientIp(req('127.0.0.1', {
      'x-real-ip': '185.177.72.29',
      'x-forwarded-for': '127.0.0.1, 185.177.72.29',
    }))).toBe('185.177.72.29');
  });

  it('ignores an attacker-supplied leftmost X-Forwarded-For hop', () => {
    // The 2026-10-24 Stripe scan: spoofed 127.0.0.1 as the first hop.
    expect(getClientIp(req('127.0.0.1', {
      'x-forwarded-for': '127.0.0.1, 185.177.72.29',
    }))).toBe('185.177.72.29');
  });

  it('falls back to the rightmost XFF hop when X-Real-IP is missing or junk', () => {
    expect(getClientIp(req('::1', { 'x-forwarded-for': '9.9.9.9, 185.177.72.29' })))
      .toBe('185.177.72.29');
    expect(getClientIp(req('127.0.0.1', {
      'x-real-ip': 'not-an-ip',
      'x-forwarded-for': '1.1.1.1, 185.177.72.29',
    }))).toBe('185.177.72.29');
  });

  it('never trusts forwarded headers from a direct (non-proxy) peer', () => {
    expect(getClientIp(req('34.34.246.117', { 'x-forwarded-for': '127.0.0.1' })))
      .toBe('34.34.246.117');
    expect(getClientIp(req('34.34.246.117', { 'x-real-ip': '127.0.0.1' })))
      .toBe('34.34.246.117');
  });

  it('returns the socket peer when nothing is forwarded', () => {
    expect(getClientIp(req('145.40.129.141'))).toBe('145.40.129.141');
    expect(getClientIp({})).toBe('unknown');
  });

  it('unwraps IPv4-mapped IPv6 peers', () => {
    expect(getClientIp(req('::ffff:127.0.0.1', { 'x-real-ip': '185.177.72.29' })))
      .toBe('185.177.72.29');
  });
});

describe('trusted proxies', () => {
  it('trusts loopback by default and parses explicit proxies', () => {
    const proxies = parseTrustedProxies(' 10.0.0.5 , 100.64.0.7 ,');
    expect(proxies.has('10.0.0.5')).toBe(true);
    expect(proxies.has('100.64.0.7')).toBe(true);
    expect(isTrustedProxyPeer('127.0.0.1')).toBe(true);
    expect(isTrustedProxyPeer('::1')).toBe(true);
    expect(isTrustedProxyPeer('34.34.246.117')).toBe(false);
    expect(isTrustedProxyPeer('10.0.0.5', proxies)).toBe(true);
  });

  it('recognises loopback forms', () => {
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(isLoopbackIp('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackIp('::1')).toBe(true);
    expect(isLoopbackIp('1270.0.0.1')).toBe(false);
    expect(isLoopbackIp('185.177.72.29')).toBe(false);
    expect(isLoopbackIp('')).toBe(false);
  });
});

describe('forwarded-header spoof detection', () => {
  it('flags a direct caller that sends X-Forwarded-For', () => {
    expect(detectForwardedSpoof(req('185.177.72.29', { 'x-forwarded-for': '127.0.0.1' })))
      .toEqual({ header: 'x-forwarded-for', value: '127.0.0.1' });
  });

  it('flags a direct caller that sends X-Real-IP', () => {
    expect(detectForwardedSpoof(req('185.177.72.29', { 'x-real-ip': '127.0.0.1' })))
      .toEqual({ header: 'x-real-ip', value: '127.0.0.1' });
  });

  it('does not flag a trusted proxy or a plain request', () => {
    expect(detectForwardedSpoof(req('127.0.0.1', { 'x-forwarded-for': '1.2.3.4' }))).toBeNull();
    expect(detectForwardedSpoof(req('34.34.246.117'))).toBeNull();
  });

  it('strips control characters from the reported value', () => {
    const found = detectForwardedSpoof(req('185.177.72.29', { 'x-forwarded-for': '127.0.0.1\nBAD' }));
    expect(found.value).toBe('127.0.0.1BAD');
  });
});

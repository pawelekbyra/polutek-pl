import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { parseVideoQueryParams, parseUserQueryParams, parsePaymentQueryParams } from '@/lib/services/admin/admin-query-parser';

describe('Admin Query Parsers', () => {
  describe('parseVideoQueryParams', () => {
    it('parses basic pagination and search', () => {
      const req = new NextRequest('http://localhost/api/admin/videos?page=2&pageSize=10&query=test');
      const result = parseVideoQueryParams(req);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.query).toBe('test');
    });

    it('validates orderBy field against whitelist', () => {
      const req = new NextRequest('http://localhost/api/admin/videos?orderBy=invalidField');
      const result = parseVideoQueryParams(req);
      expect(result.orderBy).toBe('createdAt');
    });

    it('parses boolean and enum filters', () => {
      const req = new NextRequest('http://localhost/api/admin/videos?status=PUBLISHED&isMainFeatured=true&needsAttention=true');
      const result = parseVideoQueryParams(req);
      expect(result.status).toBe('PUBLISHED');
      expect(result.isMainFeatured).toBe(true);
      expect(result.needsAttention).toBe(true);
    });
  });

  describe('parseUserQueryParams', () => {
    it('parses user specific filters', () => {
      const req = new NextRequest('http://localhost/api/admin/users?role=ADMIN&isPatron=true&language=pl');
      const result = parseUserQueryParams(req);
      expect(result.role).toBe('ADMIN');
      expect(result.isPatron).toBe(true);
      expect(result.language).toBe('pl');
    });
  });

  describe('parsePaymentQueryParams', () => {
    it('parses payment filters', () => {
      const req = new NextRequest('http://localhost/api/admin/payments?status=SUCCEEDED&currency=PLN&refundedOnly=true');
      const result = parsePaymentQueryParams(req);
      expect(result.status).toBe('SUCCEEDED');
      expect(result.currency).toBe('PLN');
      expect(result.refundedOnly).toBe(true);
    });
  });
});

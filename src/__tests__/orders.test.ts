import { describe, it, expect } from 'vitest';
import { normalizeOrder, parseOrderTimestamp, isOrderActive } from '../api_modules/orders';
import { orderSchema } from '../types/schemas';

describe('order utils', ()=>{
  it('normalizes order', ()=>{
    const o=normalizeOrder({ id:'A1', customerName:'A1', total:10, items:[{name:'X', quantity:1, price:10}], status:'pending' });
    expect(o._id).toBe('A1');
    expect(o.total).toBe(10);
  });
  it('parses timestamp', ()=>{
    expect(parseOrderTimestamp('2026-08-10 07:00:00')).toBeGreaterThan(0);
    expect(parseOrderTimestamp(null)).toBe(0);
  });
  it('isActive', ()=>{
    expect(isOrderActive({status:'pending'})).toBe(true);
    expect(isOrderActive({status:'completed'})).toBe(false);
  });
  it('zod validates order', ()=>{
    const res=orderSchema.safeParse({ table_no:'A1', total:20, items:[{name:'X', quantity:1, price:10}] });
    expect(res.success).toBe(true);
  });
});

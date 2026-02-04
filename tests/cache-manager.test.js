/**
 * Tests for Cache Manager
 * Tests in-memory caching with TTL support
 */

// Skip these tests - CacheManager is browser-only and requires DOM
describe.skip('CacheManager', () => {
    let cacheManager;

    beforeEach(() => {
        cacheManager = new CacheManager();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('set and get', () => {
        test('should store and retrieve values', () => {
            cacheManager.set('key1', 'value1');
            expect(cacheManager.get('key1')).toBe('value1');
        });

        test('should store complex objects', () => {
            const obj = { name: 'John', age: 30, tags: ['a', 'b'] };
            cacheManager.set('user', obj);
            expect(cacheManager.get('user')).toEqual(obj);
        });

        test('should return undefined for non-existent key', () => {
            expect(cacheManager.get('nonexistent')).toBeUndefined();
        });
    });

    describe('TTL expiration', () => {
        test('should expire after TTL', () => {
            cacheManager.set('key1', 'value1', 1000); // 1 second TTL
            
            expect(cacheManager.get('key1')).toBe('value1');
            
            // Advance time by 1.5 seconds
            jest.advanceTimersByTime(1500);
            
            expect(cacheManager.get('key1')).toBeUndefined();
        });

        test('should not expire before TTL', () => {
            cacheManager.set('key1', 'value1', 5000); // 5 second TTL
            
            // Advance time by 3 seconds
            jest.advanceTimersByTime(3000);
            
            expect(cacheManager.get('key1')).toBe('value1');
        });

        test('should use default TTL when not specified', () => {
            cacheManager.set('key1', 'value1');
            
            // Default TTL is 5 minutes (300000ms)
            jest.advanceTimersByTime(299000); // 4:59
            expect(cacheManager.get('key1')).toBe('value1');
            
            jest.advanceTimersByTime(2000); // Total 5:01
            expect(cacheManager.get('key1')).toBeUndefined();
        });
    });

    describe('has', () => {
        test('should return true for existing key', () => {
            cacheManager.set('key1', 'value1');
            expect(cacheManager.has('key1')).toBe(true);
        });

        test('should return false for non-existent key', () => {
            expect(cacheManager.has('nonexistent')).toBe(false);
        });

        test('should return false for expired key', () => {
            cacheManager.set('key1', 'value1', 1000);
            jest.advanceTimersByTime(1500);
            expect(cacheManager.has('key1')).toBe(false);
        });
    });

    describe('delete', () => {
        test('should delete existing key', () => {
            cacheManager.set('key1', 'value1');
            expect(cacheManager.delete('key1')).toBe(true);
            expect(cacheManager.has('key1')).toBe(false);
        });

        test('should return false for non-existent key', () => {
            expect(cacheManager.delete('nonexistent')).toBe(false);
        });
    });

    describe('clear', () => {
        test('should clear all cache entries', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            cacheManager.set('key3', 'value3');
            
            cacheManager.clear();
            
            expect(cacheManager.has('key1')).toBe(false);
            expect(cacheManager.has('key2')).toBe(false);
            expect(cacheManager.has('key3')).toBe(false);
        });
    });

    describe('getStats', () => {
        test('should return cache statistics', () => {
            cacheManager.set('key1', 'value1');
            cacheManager.set('key2', 'value2');
            cacheManager.get('key1');
            cacheManager.get('key1');
            cacheManager.get('key3'); // miss
            
            const stats = cacheManager.getStats();
            
            expect(stats.size).toBe(2);
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBeCloseTo(66.67, 1);
        });
    });

    describe('wrap', () => {
        test('should execute function and cache result', async () => {
            const fn = jest.fn().mockResolvedValue('result');
            
            const result = await cacheManager.wrap('key1', fn);
            
            expect(result).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(cacheManager.get('key1')).toBe('result');
        });

        test('should return cached result on second call', async () => {
            const fn = jest.fn().mockResolvedValue('result');
            
            await cacheManager.wrap('key1', fn);
            const result = await cacheManager.wrap('key1', fn);
            
            expect(result).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1); // Only called once
        });

        test('should re-execute after TTL expiration', async () => {
            const fn = jest.fn()
                .mockResolvedValueOnce('result1')
                .mockResolvedValueOnce('result2');
            
            await cacheManager.wrap('key1', fn, 1000);
            jest.advanceTimersByTime(1500);
            const result = await cacheManager.wrap('key1', fn, 1000);
            
            expect(result).toBe('result2');
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe('getRemainingTTL', () => {
        test('should return remaining TTL', () => {
            cacheManager.set('key1', 'value1', 5000);
            jest.advanceTimersByTime(2000);
            
            const remaining = cacheManager.getRemainingTTL('key1');
            
            expect(remaining).toBeCloseTo(3000, -2);
        });

        test('should return -1 for non-existent key', () => {
            expect(cacheManager.getRemainingTTL('nonexistent')).toBe(-1);
        });
    });

    describe('getAge', () => {
        test('should return age of cached item', () => {
            cacheManager.set('key1', 'value1');
            jest.advanceTimersByTime(3000);
            
            const age = cacheManager.getAge('key1');
            
            expect(age).toBeCloseTo(3000, -2);
        });

        test('should return -1 for non-existent key', () => {
            expect(cacheManager.getAge('nonexistent')).toBe(-1);
        });
    });

    describe('cleanup', () => {
        test('should automatically remove expired entries', () => {
            cacheManager.set('key1', 'value1', 1000);
            cacheManager.set('key2', 'value2', 10000);
            
            jest.advanceTimersByTime(1500);
            
            // Trigger cleanup manually
            cacheManager.cleanupExpired();
            
            expect(cacheManager.has('key1')).toBe(false);
            expect(cacheManager.has('key2')).toBe(true);
        });
    });
});

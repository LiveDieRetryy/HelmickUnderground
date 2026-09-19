const { normalizeRetainageRate, calculateRetainage } = require('../lib/retainage');

describe('Retainage calculations', () => {
    test('clamps retainage percentages to 0 through 100', () => {
        expect(normalizeRetainageRate(-5)).toBe(0);
        expect(normalizeRetainageRate(12.5)).toBe(12.5);
        expect(normalizeRetainageRate(125)).toBe(100);
    });

    test('calculates retainage and amount due from the invoice total', () => {
        expect(calculateRetainage(1000, 10)).toEqual({
            rate: 10,
            amount: 100,
            amountDue: 900,
            status: 'pending'
        });
    });

    test('does not withhold anything when the rate is zero', () => {
        expect(calculateRetainage(1000, 0)).toEqual({
            rate: 0,
            amount: 0,
            amountDue: 1000,
            status: 'none'
        });
    });
});

function normalizeRetainageRate(rate) {
    return Math.max(0, Math.min(100, Number(rate) || 0));
}

function calculateRetainage(total, rate) {
    const normalizedRate = normalizeRetainageRate(rate);
    const retainageAmount = Math.round(Number(total || 0) * normalizedRate) / 100;

    return {
        rate: normalizedRate,
        amount: retainageAmount,
        amountDue: Number(total || 0) - retainageAmount,
        status: retainageAmount > 0 ? 'pending' : 'none'
    };
}

module.exports = { normalizeRetainageRate, calculateRetainage };

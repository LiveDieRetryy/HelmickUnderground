const fs = require('fs');
const path = require('path');
const { calculateRetainage, normalizeRetainageRate } = require('./retainage');

const statePath = path.join(__dirname, '..', '.local-test-state.json');

const seededCustomers = [
    {
        id: 1,
        name: 'Demo Utility Customer',
        type: 'commercial',
        contact_person: 'Demo Contact',
        phone: '319-555-0100',
        email: 'demo@example.com',
        preferred_contact: 'email',
        address: '100 Test Street',
        city: 'Mount Vernon',
        state: 'IA',
        zip: '52314',
        notes: 'Local-only seeded customer.',
        custom_line_items: [],
        retainage_rate: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

const seededInvoices = [
    {
        id: 1,
        invoice_number: 'TEST-001',
        invoice_date: '2026-09-01',
        due_date: '2026-10-01',
        customer_name: 'Demo Utility Customer',
        customer_id: 1,
        customer_email: 'demo@example.com',
        customer_phone: '319-555-0100',
        customer_address: '100 Test Street, Mount Vernon, IA 52314',
        job_number: 'DEMO-001',
        job_address: '100 Test Street',
        job_city: 'Mount Vernon',
        job_state: 'IA',
        items: [{ description: 'Demo trenching', quantity: 10, rate: 100, amount: 1000 }],
        tax_rate: 0,
        subtotal: 1000,
        tax: 0,
        total: 1000,
        retainage_rate: 10,
        retainage_amount: 100,
        amount_due: 900,
        retainage_status: 'pending',
        status: 'sent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

const seededSubmissions = [
    {
        id: 1,
        name: 'Demo Contact',
        email: 'demo@example.com',
        phone: '319-555-0100',
        services: ['Trenching'],
        message: 'Local-only demo work request.',
        status: 'unread',
        timestamp: new Date().toISOString()
    }
];

const defaultAvailability = {
    status: 'accepting',
    message: 'We are currently accepting new work requests.',
    responseTimeframe: 'We typically respond within 24 hours.'
};

let customers = seededCustomers;
let invoices = seededInvoices;
let submissions = seededSubmissions;
let nextCustomerId = 2;
let nextInvoiceId = 2;
let availability = defaultAvailability;

try {
    if (fs.existsSync(statePath)) {
        const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        customers = saved.customers || seededCustomers;
        invoices = saved.invoices || seededInvoices;
        submissions = saved.submissions || seededSubmissions;
        nextCustomerId = saved.nextCustomerId || Math.max(1, ...customers.map(item => item.id)) + 1;
        nextInvoiceId = saved.nextInvoiceId || Math.max(1, ...invoices.map(item => item.id)) + 1;
        availability = saved.availability || defaultAvailability;
    }
} catch (error) {
    console.warn('[DEV_MEMORY_DB] Could not load local test state; using seed data.', error.message);
}

function enabled() {
    return process.env.DEV_MEMORY_DB === 'true' &&
        process.env.NODE_ENV !== 'production' &&
        process.env.VERCEL_ENV !== 'preview' &&
        process.env.APP_ENV !== 'preview';
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function save() {
    if (!enabled()) return;
    fs.writeFileSync(statePath, JSON.stringify({ customers, invoices, submissions, nextCustomerId, nextInvoiceId, availability }, null, 2));
}

function recalculateInvoice(invoice, retainageRate = invoice.retainage_rate) {
    const retainage = calculateRetainage(invoice.total, retainageRate);
    invoice.retainage_rate = retainage.rate;
    invoice.retainage_amount = retainage.amount;
    invoice.amount_due = retainage.amountDue;
    invoice.retainage_status = retainage.status;
    invoice.updated_at = new Date().toISOString();
    return invoice;
}

function updateCustomerRetainage(customerId, rate) {
    const customer = customers.find(item => item.id === Number(customerId));
    if (!customer) return null;
    customer.retainage_rate = Math.max(0, Math.min(100, Number(rate) || 0));
    customer.updated_at = new Date().toISOString();
    invoices
        .filter(invoice => invoice.customer_id === customer.id || (!invoice.customer_id && invoice.customer_name === customer.name))
        .forEach(invoice => recalculateInvoice(invoice, customer.retainage_rate));
    save();
    return customer;
}

module.exports = {
    enabled,
    clone,
    customers,
    invoices,
    submissions,
    save,
    nextCustomerId: () => nextCustomerId++,
    nextInvoiceId: () => nextInvoiceId++,
    recalculateInvoice,
    updateCustomerRetainage
    ,availability,
    setAvailability: value => { availability = value; save(); return availability; }
};
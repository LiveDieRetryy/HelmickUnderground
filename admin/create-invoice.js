// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/';
}

let ratesData = [];
let lineItemCounter = 0;

// Load rates data on init
async function loadRates() {
    try {
        const response = await fetch('/rates-data.json');
        if (!response.ok) throw new Error('Failed to load rates');
        
        const data = await response.json();
        ratesData = data.rates || [];
        
        displayRateButtons();
    } catch (error) {
        console.error('Error loading rates:', error);
        document.getElementById('rateButtons').innerHTML = '<div style="color: var(--red);">Failed to load rates</div>';
    }
}

// Display rate buttons
function displayRateButtons() {
    const container = document.getElementById('rateButtons');
    
    if (ratesData.length === 0) {
        container.innerHTML = '<div style="color: var(--gray);">No rates available</div>';
        return;
    }
    
    container.innerHTML = ratesData.map(rate => `
        <button type="button" class="rate-btn" onclick="addRateAsLineItem('${rate.service.replace(/'/g, "\\'")}', '${rate.unit}', ${rate.rate})">
            ${rate.service} - $${rate.rate}/${rate.unit}
        </button>
    `).join('');
}

// Add rate as line item
function addRateAsLineItem(service, unit, rate) {
    addLineItem(service, 1, rate);
}

// Add line item
function addLineItem(description = '', quantity = 1, rate = 0) {
    lineItemCounter++;
    const container = document.getElementById('lineItemsContainer');
    
    const lineItem = document.createElement('div');
    lineItem.className = 'line-item';
    lineItem.dataset.id = lineItemCounter;
    lineItem.innerHTML = `
        <div class="form-group">
            <label>Description</label>
            <input type="text" class="item-description" value="${description}" placeholder="Service description" required>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" class="item-quantity" value="${quantity}" min="0" step="0.01" onchange="calculateTotals()" required>
        </div>
        <div class="form-group">
            <label>Rate</label>
            <input type="number" class="item-rate" value="${rate}" min="0" step="0.01" onchange="calculateTotals()" required>
        </div>
        <div class="form-group">
            <label>Amount</label>
            <input type="text" class="item-amount" value="$${(quantity * rate).toFixed(2)}" readonly style="background: rgba(0,0,0,0.3);">
        </div>
        <button type="button" class="btn-remove-item" onclick="removeLineItem(${lineItemCounter})">
            🗑️
        </button>
    `;
    
    container.appendChild(lineItem);
    calculateTotals();
}

// Remove line item
function removeLineItem(id) {
    const item = document.querySelector(`.line-item[data-id="${id}"]`);
    if (item) {
        item.remove();
        calculateTotals();
    }
}

// Calculate totals
function calculateTotals() {
    const items = document.querySelectorAll('.line-item');
    let subtotal = 0;
    
    items.forEach(item => {
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const rate = parseFloat(item.querySelector('.item-rate').value) || 0;
        const amount = quantity * rate;
        
        item.querySelector('.item-amount').value = `$${amount.toFixed(2)}`;
        subtotal += amount;
    });
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    document.getElementById('subtotalDisplay').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('taxDisplay').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('totalDisplay').textContent = `$${total.toFixed(2)}`;
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now
    
    document.getElementById('invoiceDate').valueAsDate = today;
    document.getElementById('dueDate').valueAsDate = dueDate;
}

// Preview PDF (placeholder for now)
function previewPDF() {
    alert('PDF preview feature coming soon! For now, use the Save Invoice button to save your invoice.');
}

// Handle form submission
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const items = Array.from(document.querySelectorAll('.line-item')).map(item => ({
        description: item.querySelector('.item-description').value,
        quantity: parseFloat(item.querySelector('.item-quantity').value),
        rate: parseFloat(item.querySelector('.item-rate').value),
        amount: parseFloat(item.querySelector('.item-quantity').value) * parseFloat(item.querySelector('.item-rate').value)
    }));
    
    if (items.length === 0) {
        alert('Please add at least one line item');
        return;
    }
    
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    const invoiceData = {
        invoiceNumber: document.getElementById('invoiceNumber').value,
        invoiceDate: document.getElementById('invoiceDate').value,
        dueDate: document.getElementById('dueDate').value,
        customer: {
            name: document.getElementById('customerName').value,
            email: document.getElementById('customerEmail').value,
            phone: document.getElementById('customerPhone').value,
            address: document.getElementById('customerAddress').value
        },
        items: items,
        taxRate: taxRate,
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: 'draft',
        createdAt: new Date().toISOString()
    };
    
    try {
        const response = await fetch('/api/invoices?action=create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoiceData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save invoice');
        }
        
        const result = await response.json();
        alert('Invoice saved successfully!');
        window.location.href = '/admin/invoices.html';
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        alert('Failed to save invoice: ' + error.message);
    }
});

// Initialize
setDefaultDates();
loadRates();
addLineItem(); // Add one empty line item to start

// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/';
}

let ratesData = [];
let lineItemCounter = 0;
let companyProfiles = [];

// Load company profiles from localStorage
function loadProfiles() {
    const saved = localStorage.getItem('companyProfiles');
    companyProfiles = saved ? JSON.parse(saved) : [];
    updateProfileDropdown();
}

// Update profile dropdown
function updateProfileDropdown() {
    const select = document.getElementById('companyProfile');
    select.innerHTML = '<option value="">-- Select a company profile --</option>' +
        companyProfiles.map((profile, index) => 
            `<option value="${index}">${profile.name}</option>`
        ).join('');
}

// Open profile manager modal
function openProfileManager() {
    document.getElementById('profileModal').style.display = 'block';
    displayProfiles();
}

// Close profile manager modal
function closeProfileManager() {
    document.getElementById('profileModal').style.display = 'none';
    document.getElementById('newProfileName').value = '';
    document.getElementById('newProfileItems').value = '';
}

// Display saved profiles
function displayProfiles() {
    const container = document.getElementById('profilesList');
    
    if (companyProfiles.length === 0) {
        container.innerHTML = '<div style="color: var(--gray); text-align: center; padding: 2rem;">No profiles saved yet</div>';
        return;
    }
    
    container.innerHTML = companyProfiles.map((profile, index) => `
        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.2); border-radius: 12px; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h4 style="color: var(--primary-color); margin: 0 0 0.5rem 0;">${profile.name}</h4>
                    <div style="color: var(--gray); font-size: 0.9rem;">${profile.lineItems.length} custom line items</div>
                </div>
                <button onclick="deleteProfile(${index})" style="background: rgba(220, 20, 60, 0.2); border: 1px solid rgba(220, 20, 60, 0.5); color: var(--red); padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600;">\ud83d\uddd1\ufe0f Delete</button>
            </div>
            <div style="background: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 1rem; max-height: 200px; overflow-y: auto;">
                ${profile.lineItems.map(item => `
                    <div style="color: var(--gray); padding: 0.5rem 0; border-bottom: 1px solid rgba(255, 107, 26, 0.1);">
                        <span style="color: var(--white);">${item.description}</span> - 
                        <span style="color: var(--primary-color); font-weight: 600;">$${item.rate.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Save new profile
function saveNewProfile() {
    const name = document.getElementById('newProfileName').value.trim();
    const itemsText = document.getElementById('newProfileItems').value.trim();
    
    if (!name) {
        alert('Please enter a company name');
        return;
    }
    
    if (!itemsText) {
        alert('Please enter at least one line item');
        return;
    }
    
    // Parse line items
    const lines = itemsText.split('\\n').filter(line => line.trim());
    const lineItems = [];
    
    for (const line of lines) {
        const parts = line.split('-').map(p => p.trim());
        if (parts.length === 2) {
            const description = parts[0];
            const rate = parseFloat(parts[1]);
            
            if (description && !isNaN(rate)) {
                lineItems.push({ description, rate });
            }
        }
    }
    
    if (lineItems.length === 0) {
        alert('No valid line items found. Please use the format: Description - Rate');
        return;
    }
    
    // Save profile
    companyProfiles.push({
        name,
        lineItems,
        createdAt: new Date().toISOString()
    });
    
    localStorage.setItem('companyProfiles', JSON.stringify(companyProfiles));
    
    // Clear form and update display
    document.getElementById('newProfileName').value = '';
    document.getElementById('newProfileItems').value = '';
    displayProfiles();
    updateProfileDropdown();
    
    alert(`Profile "${name}" saved successfully!`);
}

// Delete profile
function deleteProfile(index) {
    if (!confirm(`Delete profile "${companyProfiles[index].name}"?`)) return;
    
    companyProfiles.splice(index, 1);
    localStorage.setItem('companyProfiles', JSON.stringify(companyProfiles));
    displayProfiles();
    updateProfileDropdown();
}

// Load company profile into form
function loadCompanyProfile() {
    const select = document.getElementById('companyProfile');
    const index = select.value;
    
    if (index === '') return;
    
    const profile = companyProfiles[index];
    if (!profile) return;
    
    // Clear existing line items
    document.getElementById('lineItemsContainer').innerHTML = '';
    lineItemCounter = 0;
    
    // Add profile's line items
    profile.lineItems.forEach(item => {
        addLineItem(item.description, 1, item.rate);
    });
    
    // Set company name
    document.getElementById('customerName').value = profile.name;
}

// Load rates data on init
async function loadRates() {
    try {
        const response = await fetch('/rates-data.json');
        if (!response.ok) throw new Error('Failed to load rates');
        
        const data = await response.json();
        // Combine all rate categories
        ratesData = [
            ...(data.baseRates || []),
            ...(data.customWork || []),
            ...(data.additionalItems || [])
        ];
        
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
        <button type="button" class="rate-btn" onclick="addRateAsLineItem('${rate.name.replace(/'/g, "\\'")}', ${rate.rate})">
            ${rate.name} - $${rate.rate}
        </button>
    `).join('');
}

// Add rate as line item
function addRateAsLineItem(service, rate) {
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
loadProfiles();
addLineItem(); // Add one empty line item to start

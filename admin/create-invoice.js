// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
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
    
    if (index === '') {
        // If no profile selected, show rates section again
        document.querySelector('.rate-selector').style.display = 'block';
        return;
    }
    
    const profile = companyProfiles[index];
    if (!profile) return;
    
    // Hide the rates section when a company profile is loaded
    document.querySelector('.rate-selector').style.display = 'none';
    
    // Populate customer information fields
    document.getElementById('customerName').value = profile.name || '';
    document.getElementById('customerEmail').value = profile.email || '';
    document.getElementById('customerPhone').value = profile.phone || '';
    
    // Build address string
    let addressParts = [];
    if (profile.address) addressParts.push(profile.address);
    
    let cityStateZip = [profile.city, profile.state, profile.zip].filter(Boolean).join(', ');
    if (cityStateZip) addressParts.push(cityStateZip);
    
    document.getElementById('customerAddress').value = addressParts.join('\n');
    
    // Clear existing line items
    document.getElementById('lineItemsContainer').innerHTML = '';
    lineItemCounter = 0;
    
    // Add profile's line items with new structure (code, description, price)
    if (profile.lineItems && profile.lineItems.length > 0) {
        profile.lineItems.forEach(item => {
            // Use code + description as the full description
            const fullDescription = item.code ? `${item.code} - ${item.description}` : item.description;
            addLineItem(fullDescription, 1, item.price || item.rate || 0);
        });
    }
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

// Generate unique invoice number
async function generateInvoiceNumber() {
    try {
        // Try to get existing invoices to determine next number
        const response = await fetch('/api/invoices?action=all');
        let invoiceCount = 0;
        
        if (response.ok) {
            const data = await response.json();
            invoiceCount = data.invoices ? data.invoices.length : 0;
        }
        
        // Format: INV-YYYYMMDD-XXX
        const today = new Date();
        const dateStr = today.getFullYear().toString() + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        const sequentialNum = (invoiceCount + 1).toString().padStart(3, '0');
        
        const invoiceNumber = `INV-${dateStr}-${sequentialNum}`;
        document.getElementById('invoiceNumber').value = invoiceNumber;
        
    } catch (error) {
        // Fallback to timestamp-based number if API fails
        const timestamp = Date.now().toString().slice(-8);
        document.getElementById('invoiceNumber').value = `INV-${timestamp}`;
    }
}

// Preview PDF (placeholder for now)
function previewPDF() {
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
    
    const invoiceDate = new Date(document.getElementById('invoiceDate').value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const dueDate = new Date(document.getElementById('dueDate').value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const previewHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <img src="/logo.png" alt="Helmick Underground" style="max-width: 200px; margin-bottom: 1rem;">
            <h1 style="color: #ff6b1a; margin: 0; font-size: 2rem;">INVOICE</h1>
            <p style="color: #666; margin: 0.5rem 0;">Invoice #${document.getElementById('invoiceNumber').value}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                <h3 style="color: #333; margin: 0 0 1rem 0;">Bill To:</h3>
                <p style="margin: 0.25rem 0; color: #666;"><strong>${document.getElementById('customerName').value}</strong></p>
                ${document.getElementById('customerEmail').value ? `<p style="margin: 0.25rem 0; color: #666;">${document.getElementById('customerEmail').value}</p>` : ''}
                ${document.getElementById('customerPhone').value ? `<p style="margin: 0.25rem 0; color: #666;">${document.getElementById('customerPhone').value}</p>` : ''}
                ${document.getElementById('customerAddress').value ? `<p style="margin: 0.25rem 0; color: #666; white-space: pre-wrap;">${document.getElementById('customerAddress').value}</p>` : ''}
            </div>
            
            <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px;">
                <p style="margin: 0.5rem 0; color: #666;"><strong>Invoice Date:</strong> ${invoiceDate}</p>
                <p style="margin: 0.5rem 0; color: #666;"><strong>Due Date:</strong> ${dueDate}</p>
            </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
            <thead>
                <tr style="background: #f0f0f0;">
                    <th style="padding: 0.75rem; text-align: left; color: #333; border-bottom: 2px solid #ff6b1a;">Description</th>
                    <th style="padding: 0.75rem; text-align: center; color: #333; border-bottom: 2px solid #ff6b1a;">Quantity</th>
                    <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ff6b1a;">Rate</th>
                    <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ff6b1a;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td style="padding: 0.75rem; border-bottom: 1px solid #eee; color: #333;">${item.description}</td>
                        <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee; color: #666;">${item.quantity}</td>
                        <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee; color: #666;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee; color: #333; font-weight: 600;">$${item.amount.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #ff6b1a;">
                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Subtotal:</td>
                    <td style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #333;">$${subtotal.toFixed(2)}</td>
                </tr>
                ${taxRate > 0 ? `
                <tr>
                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Tax (${taxRate}%):</td>
                    <td style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #ff6b1a;">$${tax.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="background: #fff3e6; font-size: 1.2rem;">
                    <td colspan="3" style="padding: 1.25rem 0.75rem; text-align: right; font-weight: 700; color: #333; border-top: 3px solid #ff6b1a;">Total Due:</td>
                    <td style="padding: 1.25rem 0.75rem; text-align: right; font-weight: 700; color: #ff6b1a; border-top: 3px solid #ff6b1a;">$${total.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #eee;">
            <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 2rem; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 1rem; font-weight: 700;">Helmick Underground</p>
                <p style="margin: 0.5rem 0; font-size: 0.9rem;">Quality Underground Utility Services</p>
                <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">📞 Tommy Helmick: (319) 721-9925</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">📧 HelmickUnderground@gmail.com</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">🌐 www.helmickunderground.com</p>
            </div>
        </div>
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'invoicePreviewModal';
    modal.style.cssText = 'display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 9999; overflow-y: auto; padding: 2rem;';
    
    modal.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; position: relative;">
            <button onclick="document.getElementById('invoicePreviewModal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: rgba(220, 20, 60, 0.9); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.5rem; z-index: 1;">×</button>
            
            <div style="padding: 3rem;">
                ${previewHTML}
            </div>
            
            <div style="padding: 2rem 3rem; background: #f5f5f5; border-top: 2px solid #e0e0e0; display: flex; gap: 1rem; border-radius: 0 0 20px 20px;">
                <button onclick="window.print()" style="flex: 1; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; padding: 1.25rem 2rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1.1rem;">
                    🖨️ Print Invoice
                </button>
                <button onclick="document.getElementById('invoicePreviewModal').remove()" style="background: rgba(0, 0, 0, 0.1); color: #333; border: 2px solid #ccc; padding: 1.25rem 2rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1.1rem;">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
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
    
    // Check if editing existing invoice
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    
    try {
        let response;
        
        if (invoiceId) {
            // Update existing invoice
            response = await fetch(`/api/invoices?action=update&id=${invoiceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(invoiceData)
            });
        } else {
            // Create new invoice
            response = await fetch('/api/invoices?action=create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(invoiceData)
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save invoice');
        }
        
        const result = await response.json();
        
        // If this invoice was created from a quote, save the invoice ID back to the submission
        const fromQuote = urlParams.get('fromQuote');
        if (fromQuote === 'true' && result.invoiceId) {
            const submissionId = sessionStorage.getItem('invoiceSubmissionId');
            if (submissionId) {
                try {
                    await fetch('/api/contact-submissions', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            id: parseInt(submissionId), 
                            invoice_id: result.invoiceId 
                        })
                    });
                    sessionStorage.removeItem('invoiceSubmissionId');
                } catch (err) {
                    console.error('Failed to link invoice to submission:', err);
                }
            }
        }
        
        alert('Invoice saved successfully!');
        window.location.href = '/admin/invoices.html';
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        alert('Failed to save invoice: ' + error.message);
    }
});

// Initialize
async function init() {
    setDefaultDates();
    await generateInvoiceNumber();
    await loadRates();
    loadProfiles();
    
    // Check if coming from accepted quote
    const urlParams = new URLSearchParams(window.location.search);
    const fromQuote = urlParams.get('fromQuote');
    
    if (fromQuote === 'true') {
        loadInvoiceFromQuote();
        return;
    }
    
    // Check if editing existing invoice
    const invoiceId = urlParams.get('id');
    
    if (invoiceId) {
        await loadInvoiceForEdit(invoiceId);
    } else {
        addLineItem(); // Add one empty line item to start
    }
}

// Load invoice data for editing
async function loadInvoiceForEdit(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        
        // Populate form fields
        document.getElementById('invoiceNumber').value = invoice.invoice_number;
        
        // Format dates to YYYY-MM-DD for date inputs
        const invoiceDate = invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '';
        const dueDate = invoice.due_date ? invoice.due_date.split('T')[0] : '';
        
        document.getElementById('invoiceDate').value = invoiceDate;
        document.getElementById('dueDate').value = dueDate;
        document.getElementById('customerName').value = invoice.customer_name;
        document.getElementById('customerEmail').value = invoice.customer_email || '';
        document.getElementById('customerPhone').value = invoice.customer_phone || '';
        document.getElementById('customerAddress').value = invoice.customer_address || '';
        document.getElementById('taxRate').value = invoice.tax_rate || 0;
        
        // Clear default line item
        const container = document.getElementById('lineItemsContainer');
        if (container) {
            container.innerHTML = '';
        }
        lineItemCounter = 0;
        
        // Load line items - parse if string
        let items;
        try {
            items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        } catch (e) {
            console.error('Error parsing items:', e);
            items = [];
        }
        
        if (Array.isArray(items)) {
            items.forEach(item => {
                addLineItem(item.description, item.quantity, item.rate);
            });
        }
        
        // Update page title
        const titleEl = document.querySelector('.page-header h1');
        if (titleEl) {
            titleEl.textContent = '✏️ Edit Invoice';
        }
        
    } catch (error) {
        console.error('Error loading invoice:', error);
        alert('Failed to load invoice. Redirecting to create new invoice.');
        window.location.href = '/admin/create-invoice.html';
    }
}

// Load invoice from accepted quote
function loadInvoiceFromQuote() {
    const dataStr = sessionStorage.getItem('invoiceFromQuote');
    if (!dataStr) {
        alert('No quote data found');
        window.location.href = '/admin/create-invoice.html';
        return;
    }
    
    try {
        const data = JSON.parse(dataStr);
        sessionStorage.removeItem('invoiceFromQuote'); // Clear after loading
        
        // Store submission ID for later when saving invoice
        if (data.submissionId) {
            sessionStorage.setItem('invoiceSubmissionId', data.submissionId);
        }
        
        // Populate customer info
        document.getElementById('customerName').value = data.customerName || '';
        document.getElementById('customerEmail').value = data.customerEmail || '';
        document.getElementById('customerPhone').value = data.customerPhone || '';
        
        // Clear default line item
        const container = document.getElementById('lineItemsContainer');
        if (container) {
            container.innerHTML = '';
        }
        lineItemCounter = 0;
        
        // Load line items from quote
        if (data.quoteData && data.quoteData.lineItems) {
            data.quoteData.lineItems.forEach(item => {
                addLineItem(item.name, item.quantity, item.rate);
            });
        }
        
        // Update page title
        const titleEl = document.querySelector('.page-header h1');
        if (titleEl) {
            titleEl.innerHTML = '📄 Create Invoice from Quote';
        }
        
        // Auto-calculate totals
        calculateTotals();
        
    } catch (error) {
        console.error('Error loading quote data:', error);
        alert('Failed to load quote data');
        window.location.href = '/admin/create-invoice.html';
    }
}

init();

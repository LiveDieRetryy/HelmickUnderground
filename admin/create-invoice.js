// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let ratesData = [];
let lineItemCounter = 0;
let companyProfiles = [];
let currentCategory = 'baseRates';

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 100000;
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Populate customer information from customer database
function populateCustomerInfo(customer) {
    // Fill in all customer fields
    if (customer.name) {
        document.getElementById('customerName').value = customer.name;
    }
    if (customer.contactPerson) {
        // Create a combined name with contact person
        const currentName = document.getElementById('customerName').value;
        document.getElementById('customerName').value = currentName + (customer.contactPerson ? ` - Attn: ${customer.contactPerson}` : '');
    }
    if (customer.phone) {
        document.getElementById('customerPhone').value = customer.phone;
    }
    if (customer.email) {
        document.getElementById('customerEmail').value = customer.email;
    }
    if (customer.address) {
        const fullAddress = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`;
        document.getElementById('customerAddress').value = fullAddress;
    }
    
    // Load custom line items if available
    if (customer.customLineItems && customer.customLineItems.length > 0) {
        // Store custom line items globally
        window.customerCustomLineItems = customer.customLineItems;
        
        // Switch to custom category and render customer's custom items
        showCategory('customerCustom');
        
        // Update tab to show it's customer-specific
        const tabs = document.querySelectorAll('.category-tab');
        if (tabs.length > 3) {
            tabs[3].textContent = `${customer.name.split(' ')[0]}'s Rates`;
        }
        
        showNotification(`Loaded ${customer.name} with ${customer.customLineItems.length} custom line items`, 'success');
    } else {
        // No custom items, show default base rates
        window.customerCustomLineItems = null;
        showNotification(`Customer information loaded for ${customer.name}`, 'success');
    }
}

// Load customers from localStorage as company profiles
function loadProfiles() {
    const saved = localStorage.getItem('customers');
    const customers = saved ? JSON.parse(saved) : [];
    
    // Convert all customers to profile format
    companyProfiles = customers.map(customer => ({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        contactPerson: customer.contactPerson,
        lineItems: customer.customLineItems || []
    }));
    
    updateProfileDropdown();
}

// Update profile dropdown
function updateProfileDropdown() {
    const select = document.getElementById('companyProfile');
    if (companyProfiles.length === 0) {
        select.innerHTML = '<option value="">-- No customers found --</option>';
    } else {
        select.innerHTML = '<option value="">-- Select a customer --</option>' +
            companyProfiles.map((profile, index) => {
                // Show company name with contact person in parentheses if available
                const displayName = profile.contactPerson 
                    ? `${profile.name} (${profile.contactPerson})`
                    : profile.name;
                return `<option value="${index}">${displayName}</option>`;
            }).join('');
    }
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
        return;
    }
    
    const profile = companyProfiles[index];
    if (!profile) return;
    
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
    
    // If customer has custom line items, add them
    if (profile.lineItems && profile.lineItems.length > 0) {
        // Clear existing line items
        document.getElementById('lineItemsContainer').innerHTML = '';
        lineItemCounter = 0;
        
        profile.lineItems.forEach(item => {
            const description = item.description || item.name || '';
            const rate = item.rate || item.price || 0;
            addLineItem(description, 1, rate);
        });
        
        showNotification(`Loaded ${profile.name} with ${profile.lineItems.length} custom line items`, 'success');
    } else {
        showNotification(`Customer information loaded for ${profile.name}`, 'success');
    }
}

// Load rates data on init
async function loadRates() {
    try {
        const response = await fetch('/rates-data.json');
        if (!response.ok) throw new Error('Failed to load rates');
        
        ratesData = await response.json();
        showCategory('baseRates');
    } catch (error) {
        console.error('Error loading rates:', error);
        document.getElementById('ratesContainer').innerHTML = '<div style="color: var(--red); text-align: center; padding: 2rem;">Failed to load rates</div>';
    }
}

// Show category
function showCategory(category) {
    currentCategory = category;
    
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Set active based on category
    const tabs = document.querySelectorAll('.category-tab');
    if (category === 'baseRates') tabs[0].classList.add('active');
    else if (category === 'customWork') tabs[1].classList.add('active');
    else if (category === 'additionalItems') tabs[2].classList.add('active');
    else if (category === 'custom' || category === 'customerCustom') tabs[3].classList.add('active');
    
    // Check if showing customer custom items
    if (category === 'customerCustom' && window.customerCustomLineItems) {
        renderCustomerLineItems();
    } else if (category === 'custom') {
        renderCustomForm();
    } else {
        renderRates();
    }
}

// Render customer's custom line items
function renderCustomerLineItems() {
    const customItems = window.customerCustomLineItems || [];
    
    if (customItems.length === 0) {
        document.getElementById('ratesContainer').innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">No custom line items for this customer</div>
        `;
        return;
    }

    document.getElementById('ratesContainer').innerHTML = customItems.map((item, index) => `
        <button type="button" class="rate-button" onclick="addRateAsLineItem('${item.description.replace(/'/g, "\\'")}', ${item.rate})">
            <span class="rate-name">${item.description}</span>
            <span class="rate-price">$${item.rate.toFixed(2)}</span>
        </button>
    `).join('');
}

// Render rates for current category
function renderRates() {
    const rates = ratesData[currentCategory] || [];
    
    if (rates.length === 0) {
        document.getElementById('ratesContainer').innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 2rem;">No rates available in this category</div>
        `;
        return;
    }

    document.getElementById('ratesContainer').innerHTML = rates.map(rate => `
        <button type="button" class="rate-button" onclick="addRateAsLineItem('${rate.name.replace(/'/g, "\\'")}', ${rate.rate})">
            <span class="rate-name">${rate.name}</span>
            <span class="rate-price">$${rate.rate.toFixed(2)}</span>
        </button>
    `).join('');
}

// Render custom line item form
function renderCustomForm() {
    document.getElementById('ratesContainer').innerHTML = `
        <div style="grid-column: 1 / -1; background: rgba(255, 107, 26, 0.05); border: 2px solid rgba(255, 107, 26, 0.3); border-radius: 12px; padding: 2rem;">
            <h3 style="color: var(--primary-color); margin-bottom: 1.5rem; font-size: 1.2rem;">Create Custom Line Item</h3>
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Item Name *</label>
                    <input type="text" id="customItemName" placeholder="e.g., Special excavation work" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Quantity *</label>
                        <input type="number" id="customItemQuantity" placeholder="1" min="0" step="0.01" value="1" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                    </div>
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Rate ($) *</label>
                        <input type="number" id="customItemRate" placeholder="0.00" min="0" step="0.01" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                    </div>
                    <div style="display: flex; align-items: end;">
                        <button type="button" onclick="addCustomLineItem()" style="width: 100%; background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); border: none; padding: 0.75rem; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;">
                            ➕ Add Item
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add custom line item
function addCustomLineItem() {
    const name = document.getElementById('customItemName').value.trim();
    const rate = parseFloat(document.getElementById('customItemRate').value);
    const quantity = parseFloat(document.getElementById('customItemQuantity').value);
    
    if (!name) {
        showNotification('Please enter an item name', 'error');
        return;
    }
    
    if (isNaN(rate) || rate < 0) {
        showNotification('Please enter a valid rate', 'error');
        return;
    }
    
    if (isNaN(quantity) || quantity <= 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }
    
    addLineItem(name, quantity, rate);
    
    // Clear form
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemRate').value = '';
    document.getElementById('customItemQuantity').value = '1';
    
    showNotification('Custom item added successfully', 'success');
}

// Display rate buttons (deprecated, keeping for compatibility)
function displayRateButtons() {
    // This function is no longer used but kept for compatibility
    if (ratesData && ratesData.baseRates) {
        showCategory('baseRates');
    }
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
    let itemCount = 0;
    
    items.forEach(item => {
        const quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        const rate = parseFloat(item.querySelector('.item-rate').value) || 0;
        const amount = quantity * rate;
        
        item.querySelector('.item-amount').value = `$${amount.toFixed(2)}`;
        subtotal += amount;
        if (quantity > 0) itemCount++;
    });
    
    // Check if Iowa work checkbox is checked
    const iowaWorkCheckbox = document.getElementById('iowaWorkCheckbox');
    const taxRate = iowaWorkCheckbox && iowaWorkCheckbox.checked ? 7 : 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    // Update displays
    document.getElementById('totalItems').textContent = itemCount;
    document.getElementById('subtotalDisplay').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('taxDisplay').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('totalDisplay').textContent = `$${total.toFixed(2)}`;
    
    // Show/hide tax row
    const taxRow = document.getElementById('taxRow');
    if (taxRow) {
        taxRow.style.display = taxRate > 0 ? 'flex' : 'none';
    }
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
    
    // Use checkbox for tax rate
    const iowaWorkCheckbox = document.getElementById('iowaWorkCheckbox');
    const taxRate = iowaWorkCheckbox && iowaWorkCheckbox.checked ? 7 : 0;
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
    
    // Check if Iowa work checkbox is checked for tax calculation
    const iowaWorkCheckbox = document.getElementById('iowaWorkCheckbox');
    const taxRate = iowaWorkCheckbox && iowaWorkCheckbox.checked ? 7 : 0;
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    // Get invoice notes
    const invoiceNotes = document.getElementById('invoiceNotes')?.value || '';
    
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
        jobInfo: {
            jobNumber: document.getElementById('jobNumber')?.value || '',
            jobAddress: document.getElementById('jobAddress')?.value || '',
            jobCity: document.getElementById('jobCity')?.value || '',
            jobState: document.getElementById('jobState')?.value || ''
        },
        items: items,
        taxRate: taxRate,
        subtotal: subtotal,
        tax: tax,
        total: total,
        notes: invoiceNotes,
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
        
        showNotification('Invoice saved successfully!', 'success');
        setTimeout(() => {
            window.location.href = '/admin/invoices.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error saving invoice:', error);
        showNotification('Failed to save invoice: ' + error.message, 'error');
    }
});

// Initialize
async function init() {
    setDefaultDates();
    await generateInvoiceNumber();
    await loadRates();
    loadProfiles();
    
    // Check if coming from customer database
    const customerData = sessionStorage.getItem('invoiceCustomer');
    if (customerData) {
        try {
            const customer = JSON.parse(customerData);
            populateCustomerInfo(customer);
            sessionStorage.removeItem('invoiceCustomer'); // Clear after loading
        } catch (error) {
            console.error('Error loading customer data:', error);
        }
    }
    
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
    }
    // Don't add a default empty line item - user can add items manually
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
        
        // Load job information if available
        if (invoice.job_number) document.getElementById('jobNumber').value = invoice.job_number;
        if (invoice.job_address) document.getElementById('jobAddress').value = invoice.job_address;
        if (invoice.job_city) document.getElementById('jobCity').value = invoice.job_city;
        if (invoice.job_state) document.getElementById('jobState').value = invoice.job_state;
        
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

// Preview invoice in modal
function previewInvoice() {
    const items = Array.from(document.querySelectorAll('.line-item')).map(item => ({
        description: item.querySelector('.item-description').value,
        quantity: parseFloat(item.querySelector('.item-quantity').value),
        rate: parseFloat(item.querySelector('.item-rate').value),
        amount: parseFloat(item.querySelector('.item-quantity').value) * parseFloat(item.querySelector('.item-rate').value)
    })).filter(item => item.quantity > 0 && item.description);
    
    if (items.length === 0) {
        alert('Please add at least one line item');
        return;
    }
    
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const invoiceDate = new Date(document.getElementById('invoiceDate').value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const dueDate = new Date(document.getElementById('dueDate').value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const customerAddress = document.getElementById('customerAddress').value;
    const invoiceNotes = document.getElementById('invoiceNotes')?.value || '';
    const jobNumber = document.getElementById('jobNumber')?.value || '';
    const jobAddress = document.getElementById('jobAddress')?.value || '';
    const jobCity = document.getElementById('jobCity')?.value || '';
    const jobState = document.getElementById('jobState')?.value || '';
    
    // Parse customer name to separate business name and contact person
    let businessName = customerName;
    let contactPerson = '';
    if (customerName.includes(' - Attn: ')) {
        const parts = customerName.split(' - Attn: ');
        businessName = parts[0];
        contactPerson = parts[1];
    }
    
    const previewHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <img src="../logo.png" alt="Helmick Underground" style="max-width: 150px; margin-bottom: 0.5rem;">
            <h1 style="color: #ff6b1a; margin: 0; font-size: 1.75rem;">INVOICE</h1>
            <p style="color: #666; margin: 0.25rem 0; font-size: 0.9rem;">Invoice #${invoiceNumber}</p>
        </div>
        
        ${jobNumber || jobAddress ? `
        <div style="background: #fff3e6; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ff6b1a;">
            <h3 style="color: #ff6b1a; margin: 0 0 0.5rem 0; font-size: 0.95rem;">🏗️ Project Information</h3>
            ${jobNumber ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.85rem;"><strong>Job Number:</strong> ${jobNumber}</p>` : ''}
            ${jobAddress ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.85rem;"><strong>Job Location:</strong> ${jobAddress}${jobCity ? `, ${jobCity}` : ''}${jobState ? `, ${jobState}` : ''}</p>` : ''}
        </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                <h3 style="color: #333; margin: 0 0 0.75rem 0; font-size: 1rem;">Bill To:</h3>
                ${businessName ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.9rem; font-weight: 600;">${businessName}</p>` : ''}
                ${contactPerson ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.9rem;">${contactPerson}</p>` : ''}
                ${customerAddress ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.85rem; white-space: pre-wrap;">${customerAddress}</p>` : ''}
                ${customerEmail ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.85rem;">${customerEmail}</p>` : ''}
                ${customerPhone ? `<p style="margin: 0.2rem 0; color: #666; font-size: 0.85rem;">${customerPhone}</p>` : ''}
            </div>
            
            <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px;">
                <p style="margin: 0.4rem 0; color: #666; font-size: 0.9rem;"><strong>Invoice Date:</strong> ${invoiceDate}</p>
                <p style="margin: 0.4rem 0; color: #666; font-size: 0.9rem;"><strong>Due Date:</strong> ${dueDate}</p>
            </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem;">
            <thead>
                <tr style="background: #f0f0f0;">
                    <th style="padding: 0.5rem; text-align: left; color: #333; border-bottom: 2px solid #ff6b1a; font-size: 0.85rem;">Description</th>
                    <th style="padding: 0.5rem; text-align: center; color: #333; border-bottom: 2px solid #ff6b1a; font-size: 0.85rem;">Qty</th>
                    <th style="padding: 0.5rem; text-align: right; color: #333; border-bottom: 2px solid #ff6b1a; font-size: 0.85rem;">Rate</th>
                    <th style="padding: 0.5rem; text-align: right; color: #333; border-bottom: 2px solid #ff6b1a; font-size: 0.85rem;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td style="padding: 0.5rem; border-bottom: 1px solid #eee; color: #333; font-size: 0.85rem;">${item.description}</td>
                        <td style="padding: 0.5rem; text-align: center; border-bottom: 1px solid #eee; color: #666; font-size: 0.85rem;">${item.quantity}</td>
                        <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid #eee; color: #666; font-size: 0.85rem;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid #eee; color: #333; font-weight: 600; font-size: 0.85rem;">$${item.amount.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #ff6b1a;">
                    <td colspan="3" style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 600; color: #666; font-size: 0.9rem;">Subtotal:</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: right; color: #333; font-weight: 600; font-size: 0.9rem;">$${subtotal.toFixed(2)}</td>
                </tr>
                ${iowaWork && tax > 0 ? `
                <tr>
                    <td colspan="3" style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 600; color: #666; font-size: 0.9rem;">Tax (7% - Iowa):</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: right; color: #ff6b1a; font-weight: 600; font-size: 0.9rem;">$${tax.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="background: #fff3e6; font-size: 1.1rem; font-weight: 700;">
                    <td colspan="3" style="padding: 0.8rem 0.5rem; text-align: right; color: #333; border-top: 3px solid #ff6b1a;">Total Due:</td>
                    <td style="padding: 0.8rem 0.5rem; text-align: right; color: #ff6b1a; border-top: 3px solid #ff6b1a;">$${total.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>

        ${invoiceNotes ? `
            <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #ff6b1a;">
                <h3 style="color: #333; font-size: 0.95rem; margin: 0 0 0.5rem 0;">Notes</h3>
                <div style="color: #666; white-space: pre-wrap; line-height: 1.5; font-size: 0.85rem;">${invoiceNotes}</div>
            </div>
        ` : ''}

        <div style="text-align: center; padding: 1rem 0; border-top: 2px solid #eee; margin-top: 1rem;">
            <p style="color: #666; margin: 0; font-size: 0.8rem;">Thank you for your business!</p>
            <p style="color: #666; margin: 0.3rem 0 0 0; font-size: 0.8rem;">Payment is due by ${dueDate}</p>
        </div>
    `;
    
    document.getElementById('invoicePreviewContent').innerHTML = previewHTML;
    document.getElementById('invoicePreviewModal').style.display = 'block';
}

// Close invoice preview modal
function closeInvoicePreview() {
    document.getElementById('invoicePreviewModal').style.display = 'none';
}

// Download invoice as PDF
async function downloadInvoicePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 50;
        
        // Get invoice data
        const items = Array.from(document.querySelectorAll('.line-item')).map(item => ({
            description: item.querySelector('.item-description').value,
            quantity: parseFloat(item.querySelector('.item-quantity').value),
            rate: parseFloat(item.querySelector('.item-rate').value),
            amount: parseFloat(item.querySelector('.item-quantity').value) * parseFloat(item.querySelector('.item-rate').value)
        })).filter(item => item.quantity > 0 && item.description);
        
        const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const taxRate = iowaWork ? 0.07 : 0;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;
        
        const invoiceNumber = document.getElementById('invoiceNumber').value;
        const invoiceDate = new Date(document.getElementById('invoiceDate').value).toLocaleDateString();
        const dueDate = new Date(document.getElementById('dueDate').value).toLocaleDateString();
        const customerName = document.getElementById('customerName').value;
        const customerEmail = document.getElementById('customerEmail').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const customerAddress = document.getElementById('customerAddress').value;
        const invoiceNotes = document.getElementById('invoiceNotes')?.value || '';
        const jobNumber = document.getElementById('jobNumber')?.value || '';
        const jobAddress = document.getElementById('jobAddress')?.value || '';
        const jobCity = document.getElementById('jobCity')?.value || '';
        const jobState = document.getElementById('jobState')?.value || '';
        
        // Parse customer name to separate business name and contact person
        let businessName = customerName;
        let contactPerson = '';\n        if (customerName.includes(' - Attn: ')) {
            const parts = customerName.split(' - Attn: ');
            businessName = parts[0];
            contactPerson = parts[1];
        }
        
        // White background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        let yPos = margin;
        
        // Logo
        try {
            const logoBase64 = await getLogoBase64();
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', margin, yPos, 100, 50);
            }
        } catch (e) {
            console.error('Logo failed to load:', e);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Helmick Underground', margin, yPos + 20);
        }
        
        // INVOICE header
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 107, 26);
        doc.setLineWidth(2);
        doc.roundedRect(pageWidth - margin - 140, yPos, 140, 50, 3, 3, 'FD');
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth - margin - 70, yPos + 25, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`#${invoiceNumber}`, pageWidth - margin - 70, yPos + 40, { align: 'center' });
        
        yPos += 65;
        
        // Project Information (if provided)
        if (jobNumber || jobAddress) {
            doc.setFillColor(255, 243, 230);
            const jobBoxHeight = 45;
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, jobBoxHeight, 3, 3, 'F');
            doc.setFillColor(255, 107, 26);
            doc.rect(margin, yPos, 3, jobBoxHeight, 'F');
            
            doc.setTextColor(255, 107, 26);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Project Information', margin + 15, yPos + 15);
            
            let jobY = yPos + 28;
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            
            if (jobNumber) {
                doc.setFont('helvetica', 'bold');
                doc.text('Job Number:', margin + 15, jobY);
                doc.setFont('helvetica', 'normal');
                doc.text(jobNumber, margin + 85, jobY);
            }
            
            if (jobAddress) {
                const locationText = `${jobAddress}${jobCity ? `, ${jobCity}` : ''}${jobState ? `, ${jobState}` : ''}`;
                doc.setFont('helvetica', 'bold');
                doc.text('Job Location:', pageWidth / 2 + 10, jobY);
                doc.setFont('helvetica', 'normal');
                doc.text(locationText, pageWidth / 2 + 75, jobY);
            }
            
            yPos += jobBoxHeight + 15;
        }
        
        // From/Bill To Section
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, (pageWidth - 2 * margin - 20) / 2, 100, 3, 3, 'F');
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos, 3, 100, 'F');
        
        // From
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('From:', margin + 15, yPos + 18);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text('Helmick Underground', margin + 15, yPos + 33);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('498 Elbow Creek Rd', margin + 15, yPos + 48);
        doc.text('Mount Vernon, IA 52314', margin + 15, yPos + 61);
        doc.text('HelmickUnderground@gmail.com', margin + 15, yPos + 74);
        doc.text('(319) 229-4046', margin + 15, yPos + 87);
        
        // Bill To
        const billToX = pageWidth / 2 + 10;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(billToX, yPos, (pageWidth - 2 * margin - 20) / 2, 100, 3, 3, 'F');
        doc.setFillColor(255, 107, 26);
        doc.rect(billToX, yPos, 3, 100, 'F');
        
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', billToX + 15, yPos + 18);
        
        let billToY = yPos + 33;
        
        if (businessName) {
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(businessName, billToX + 15, billToY);
            billToY += 13;
        }
        
        if (contactPerson) {
            doc.setTextColor(80, 80, 80);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(contactPerson, billToX + 15, billToY);
            billToY += 13;
        }
        
        if (customerAddress) {
            const addressLines = customerAddress.split('\n');
            addressLines.forEach(line => {
                if (billToY < yPos + 95) {
                    doc.text(line.trim(), billToX + 15, billToY);
                    billToY += 13;
                }
            });
        }
        
        if (customerEmail && billToY < yPos + 95) {
            doc.text(customerEmail, billToX + 15, billToY);
            billToY += 13;
        }
        
        if (customerPhone && billToY < yPos + 95) {
            doc.text(customerPhone, billToX + 15, billToY);
        }
        
        yPos += 115;
        
        // Invoice Details
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 40, 3, 3, 'F');
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos, 3, 40, 'F');
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Date:', margin + 15, yPos + 15);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(invoiceDate, margin + 15, yPos + 28);
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Due Date:', pageWidth - margin - 150, yPos + 15);
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(dueDate, pageWidth - margin - 150, yPos + 28);
        
        yPos += 55;
        
        // Line Items Table
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        
        // Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 28, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', margin + 10, yPos + 17);
        doc.text('Qty', pageWidth - margin - 220, yPos + 17, { align: 'center' });
        doc.text('Rate', pageWidth - margin - 140, yPos + 17, { align: 'right' });
        doc.text('Amount', pageWidth - margin - 10, yPos + 17, { align: 'right' });
        
        yPos += 28;
        
        // Table Rows
        doc.setFont('helvetica', 'normal');
        items.forEach((item, index) => {
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos, pageWidth - 2 * margin, 22, 'F');
            }
            
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, yPos + 22, pageWidth - margin, yPos + 22);
            
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(9);
            const maxDescWidth = pageWidth - margin - 250;
            doc.text(item.description, margin + 10, yPos + 14, { maxWidth: maxDescWidth });
            doc.setTextColor(80, 80, 80);
            doc.text(item.quantity.toString(), pageWidth - margin - 220, yPos + 14, { align: 'center' });
            doc.text(`$${item.rate.toFixed(2)}`, pageWidth - margin - 140, yPos + 14, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${item.amount.toFixed(2)}`, pageWidth - margin - 10, yPos + 14, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            
            yPos += 22;
        });
        
        // Calculate footer position
        const footerHeight = 120;
        const footerStartY = pageHeight - margin - footerHeight;
        yPos = Math.max(yPos, footerStartY);
        
        // Orange separator
        doc.setDrawColor(255, 107, 26);
        doc.setLineWidth(2);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 15;
        
        // Subtotal
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Subtotal:', pageWidth - margin - 150, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        doc.text(`$${subtotal.toFixed(2)}`, pageWidth - margin - 10, yPos, { align: 'right' });
        yPos += 18;
        
        // Tax
        if (taxRate > 0) {
            doc.setTextColor(80, 80, 80);
            doc.text('Tax (7% - Iowa):', pageWidth - margin - 150, yPos, { align: 'right' });
            doc.setTextColor(255, 107, 26);
            doc.text(`$${tax.toFixed(2)}`, pageWidth - margin - 10, yPos, { align: 'right' });
            yPos += 18;
        }
        
        // Total
        doc.setDrawColor(255, 107, 26);
        doc.setLineWidth(2);
        doc.line(pageWidth - margin - 250, yPos - 5, pageWidth - margin, yPos - 5);
        doc.setFillColor(255, 243, 230);
        doc.rect(pageWidth - margin - 250, yPos, 250, 30, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL DUE:', pageWidth - margin - 170, yPos + 20, { align: 'right' });
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${total.toFixed(2)}`, pageWidth - margin - 10, yPos + 20, { align: 'right' });
        
        // Notes section
        if (invoiceNotes) {
            yPos += 45;
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 60, 3, 3, 'F');
            doc.setFillColor(255, 107, 26);
            doc.rect(margin, yPos, 3, 60, 'F');
            
            doc.setTextColor(255, 107, 26);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Notes:', margin + 15, yPos + 15);
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const noteLines = doc.splitTextToSize(invoiceNotes, pageWidth - 2 * margin - 30);
            doc.text(noteLines, margin + 15, yPos + 30);
        }
        
        // Footer
        const footerY = pageHeight - margin;
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Thank you for your business!', pageWidth / 2, footerY - 25, { align: 'center' });
        doc.text(`Payment is due by ${dueDate}`, pageWidth / 2, footerY - 15, { align: 'center' });
        
        // Save PDF
        doc.save(`Invoice-${invoiceNumber}.pdf`);
        
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

// Helper function to load logo as base64
async function getLogoBase64() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                console.error('Canvas conversion error:', e);
                reject(e);
            }
        };
        img.onerror = function(e) {
            console.error('Image load error:', e);
            reject(e);
        };
        img.src = '/logo.png';
    });
}

// Print invoice
function printInvoice() {
    const printWindow = window.open('', '', 'width=800,height=600');
    const content = document.getElementById('invoicePreviewContent').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice - Helmick Underground</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { margin: 0.5in; size: auto; }
                @media print {
                    body { margin: 0; padding: 0; font-size: 10pt; }
                    @page { margin: 0.5in; size: portrait; }
                }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #333; }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Email invoice
async function emailInvoice() {
    const customerEmail = document.getElementById('customerEmail').value;
    const customerName = document.getElementById('customerName').value;
    
    if (!customerEmail) {
        alert('Please enter a customer email address first.');
        return;
    }
    
    try {
        // Get invoice data
        const items = Array.from(document.querySelectorAll('.line-item')).map(item => ({
            description: item.querySelector('.item-description').value,
            quantity: parseFloat(item.querySelector('.item-quantity').value),
            rate: parseFloat(item.querySelector('.item-rate').value)
        })).filter(item => item.quantity > 0 && item.description);
        
        const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const taxRate = iowaWork ? 7 : 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;
        
        const invoiceNumber = document.getElementById('invoiceNumber').value;
        const invoiceDate = new Date(document.getElementById('invoiceDate').value);
        const dueDate = new Date(document.getElementById('dueDate').value);
        const customerAddress = document.getElementById('customerAddress').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const jobNumber = document.getElementById('jobNumber')?.value || '';
        const jobAddress = document.getElementById('jobAddress')?.value || '';
        const jobCity = document.getElementById('jobCity')?.value || '';
        const jobState = document.getElementById('jobState')?.value || '';
        
        // Parse customer name to separate business name and contact person
        let businessName = customerName;
        let contactPerson = '';
        if (customerName.includes(' - Attn: ')) {
            const parts = customerName.split(' - Attn: ');
            businessName = parts[0];
            contactPerson = parts[1];
        }
        
        const emailSubject = jobNumber 
            ? `Job #${jobNumber} - Invoice ${invoiceNumber} from Helmick Underground`
            : `Invoice ${invoiceNumber} from Helmick Underground`;
        
        // Create styled HTML email (same template as invoices.js)
        const emailHTML = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: #1a1a1a; color: #e5e7eb;">
                <!-- Header with Logo -->
                <div style="background: #1a1a1a; padding: 2rem 2rem 1rem 2rem; text-align: center; border-radius: 12px 12px 0 0;">
                    <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="max-width: 250px; height: auto; margin-bottom: 1.5rem;">
                </div>
                <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 1.5rem 2rem; text-align: center;">
                    <h2 style="color: white; margin: 0; font-size: 1.8rem; font-weight: 700;">INVOICE</h2>
                </div>

                <!-- Company Billing Address -->
                <div style="background: #2a2a2a; padding: 1.5rem 2rem; border-bottom: 3px solid #ff6b1a;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="width: 50%; vertical-align: top; padding-right: 1rem;">
                                <h3 style="color: #ff6b1a; margin: 0 0 0.75rem 0; font-size: 1rem;">From:</h3>
                                <p style="margin: 0; line-height: 1.6; color: #ffffff; font-weight: 600;">Helmick Underground</p>
                                <p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">498 Elbow Creek Rd</p>
                                <p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">Mount Vernon, IA 52314</p>
                                <p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">HelmickUnderground@gmail.com</p>
                            </td>
                            <td style="width: 50%; vertical-align: top; padding-left: 1rem;">
                                <h3 style="color: #ff6b1a; margin: 0 0 0.75rem 0; font-size: 1rem;">Bill To:</h3>
                                ${businessName ? `<p style="margin: 0; line-height: 1.6; color: #ffffff; font-weight: 600;">${businessName}</p>` : ''}
                                ${contactPerson ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${contactPerson}</p>` : ''}
                                ${customerAddress ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${customerAddress}</p>` : ''}
                                ${customerEmail ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${customerEmail}</p>` : ''}
                                ${customerPhone ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${customerPhone}</p>` : ''}
                            </td>
                        </tr>
                    </table>
                </div>

                ${jobNumber || jobAddress ? `
                <!-- Project Information -->
                <div style="background: #2a2a2a; padding: 1.5rem 2rem; border-bottom: 2px solid #ff6b1a;">
                    <h3 style="color: #ff6b1a; margin: 0 0 0.75rem 0; font-size: 1rem;">🏗️ Project Information:</h3>
                    ${jobNumber ? `<p style="margin: 0.25rem 0; color: #b0b0b0;"><strong style="color: #fff;">Job Number:</strong> ${jobNumber}</p>` : ''}
                    ${jobAddress ? `<p style="margin: 0.25rem 0; color: #b0b0b0;"><strong style="color: #fff;">Job Location:</strong> ${jobAddress}${jobCity ? `, ${jobCity}` : ''}${jobState ? `, ${jobState}` : ''}</p>` : ''}
                </div>
                ` : ''}

                <!-- Invoice Details -->
                <div style="padding: 2rem; background: #1a1a1a;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                        <tr>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Number:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 1.1rem;">${invoiceNumber}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700;">${invoiceDate.toLocaleDateString()}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Due Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ff6b1a; font-weight: 700;">${dueDate.toLocaleDateString()}</p>
                            </td>
                        </tr>
                    </table>

                    <!-- Line Items Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #333; color: white;">
                                <th style="padding: 1rem; text-align: left; font-weight: 700;">Description</th>
                                <th style="padding: 1rem; text-align: center; font-weight: 700;">Qty</th>
                                <th style="padding: 1rem; text-align: right; font-weight: 700;">Rate</th>
                                <th style="padding: 1rem; text-align: right; font-weight: 700;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr style="border-bottom: 1px solid #404040;">
                                    <td style="padding: 1rem; color: #e5e7eb;">${item.description}</td>
                                    <td style="padding: 1rem; text-align: center; color: #b0b0b0;">${item.quantity}</td>
                                    <td style="padding: 1rem; text-align: right; color: #b0b0b0;">$${item.rate.toFixed(2)}</td>
                                    <td style="padding: 1rem; text-align: right; color: #ffffff; font-weight: 600;">$${(item.quantity * item.rate).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #ff6b1a;">
                                <td colspan="3" style="padding: 1rem; text-align: right; font-weight: 600; color: #b0b0b0;">Subtotal:</td>
                                <td style="padding: 1rem; text-align: right; font-weight: 600; color: #ffffff;">$${subtotal.toFixed(2)}</td>
                            </tr>
                            ${taxRate > 0 ? `
                            <tr>
                                <td colspan="3" style="padding: 0.5rem 1rem; text-align: right; color: #b0b0b0;">Tax (${taxRate}%):</td>
                                <td style="padding: 0.5rem 1rem; text-align: right; color: #ffffff;">$${tax.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white;">
                                <td colspan="3" style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">Total Due:</td>
                                <td style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">$${total.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <!-- Thank You Message -->
                    <div style="background: #2a2a2a; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 2rem;">
                        <p style="margin: 0; color: #e5e7eb; line-height: 1.6;">Thank you for choosing <strong style="color: #ff6b1a;">Helmick Underground</strong> for your underground utility needs! We appreciate your business and look forward to serving you again.</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #333 0%, #1a1a1a 100%); color: white; padding: 2rem; text-align: center; border-radius: 0 0 12px 12px;">
                    <h3 style="margin: 0 0 1rem 0; color: #ff6b1a; font-size: 1.2rem;">Helmick Underground</h3>
                    <p style="margin: 0.5rem 0; color: #ccc; font-size: 0.95rem;">Quality Underground Utility Services Since 1988</p>
                    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #444;">
                        <p style="margin: 0.5rem 0; color: #fff;">📞 Tommy Helmick: (319) 721-9925</p>
                        <p style="margin: 0.5rem 0; color: #fff;">📧 HelmickUnderground@gmail.com</p>
                        <p style="margin: 0.5rem 0; color: #fff;">🌐 www.helmickunderground.com</p>
                    </div>
                </div>
            </div>
        `;
        
        // Send email via consolidated email API
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'invoice',
                to: customerEmail,
                subject: emailSubject,
                html: emailHTML,
                name: customerName,
                metadata: {
                    invoiceNumber: invoiceNumber
                }
            })
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to send email');
        }
        
        alert(`✅ Invoice successfully sent to ${customerEmail}!`);
        closeInvoicePreview();
        
    } catch (error) {
        console.error('Error sending invoice email:', error);
        alert('❌ Failed to send invoice email: ' + error.message);
    }
}

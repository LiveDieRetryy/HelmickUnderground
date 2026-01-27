let rates = {};
let lineItems = [];
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

// Load rates data
async function loadData() {
    try {
        const response = await fetch('/rates-data.json');
        rates = await response.json();
        showCategory('baseRates');
    } catch (error) {
        console.error('Error loading rates:', error);
        document.getElementById('ratesContainer').innerHTML = '<div style="text-align: center; color: crimson; padding: 2rem;">Error loading rates</div>';
    }
}

function showCategory(category) {
    currentCategory = category;
    
    // Update tab styling
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const container = document.getElementById('ratesContainer');
    
    if (category === 'custom') {
        renderCustomForm();
        return;
    }
    
    const categoryRates = rates[category] || [];
    
    if (categoryRates.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 2rem;">No rates available</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="rates-grid">
            ${categoryRates.map(rate => `
                <button class="rate-button" onclick="addLineItem('${rate.id}', '${rate.name.replace(/'/g, "\\'")}', ${rate.rate})">
                    <span class="rate-name">${rate.name}</span>
                    <span class="rate-price">$${rate.rate.toFixed(2)}</span>
                </button>
            `).join('')}
        </div>
    `;
}

function renderCustomForm() {
    const container = document.getElementById('ratesContainer');
    container.innerHTML = `
        <div class="custom-item-form">
            <div class="form-group">
                <label>Item Name *</label>
                <input type="text" id="customItemName" placeholder="e.g., Special Equipment Rental">
            </div>
            <div class="custom-form-row">
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="customItemDesc" placeholder="Optional description">
                </div>
                <div class="form-group">
                    <label>Rate (per unit) *</label>
                    <input type="number" id="customItemRate" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Quantity *</label>
                    <input type="number" id="customItemQty" placeholder="1" step="1" min="1" value="1">
                </div>
            </div>
            <button class="save-quote-btn" onclick="addCustomLineItem()" style="margin-top: 1rem;">
                ➕ Add Custom Item
            </button>
        </div>
    `;
}

function addLineItem(id, name, rate) {
    const item = {
        id: Date.now(),
        rateId: id,
        name: name,
        rate: rate,
        quantity: 1,
        description: ''
    };
    
    lineItems.push(item);
    renderLineItems();
    updateSummary();
}

function addCustomLineItem() {
    const name = document.getElementById('customItemName').value.trim();
    const rate = parseFloat(document.getElementById('customItemRate').value);
    const quantity = parseInt(document.getElementById('customItemQty').value);
    const description = document.getElementById('customItemDesc').value.trim();
    
    if (!name) {
        showNotification('Please enter an item name', 'error');
        return;
    }
    
    if (!rate || rate <= 0) {
        showNotification('Please enter a valid rate', 'error');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }
    
    const item = {
        id: Date.now(),
        rateId: 'custom',
        name: name,
        rate: rate,
        quantity: quantity,
        description: description
    };
    
    lineItems.push(item);
    renderLineItems();
    updateSummary();
    
    // Clear form
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemRate').value = '';
    document.getElementById('customItemQty').value = '1';
    document.getElementById('customItemDesc').value = '';
}

function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    
    if (lineItems.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 3rem;">No items added yet. Click on a rate above to add it to the quote.</div>';
        return;
    }
    
    container.innerHTML = lineItems.map(item => `
        <div class="line-item">
            <div class="line-item-header">
                <div class="line-item-name">${item.name}</div>
                <div class="line-item-controls">
                    <button class="item-btn remove" onclick="removeLineItem(${item.id})">🗑️ Remove</button>
                </div>
            </div>
            
            <div class="line-item-details">
                <div class="detail-group">
                    <label class="detail-label">Quantity</label>
                    <input type="number" class="detail-input" value="${item.quantity}" min="1" 
                           onchange="updateItemQuantity(${item.id}, this.value)">
                </div>
                <div class="detail-group">
                    <label class="detail-label">Rate (per unit)</label>
                    <input type="number" class="detail-input" value="${item.rate}" step="0.01" min="0"
                           onchange="updateItemRate(${item.id}, this.value)">
                </div>
                <div class="detail-group">
                    <label class="detail-label">Total</label>
                    <div class="detail-input" style="background: rgba(255, 107, 26, 0.1); border-color: var(--primary-color); color: var(--primary-color); font-weight: 700;">
                        $${(item.quantity * item.rate).toFixed(2)}
                    </div>
                </div>
            </div>
            
            <div class="detail-group" style="margin-top: 1rem;">
                <label class="detail-label">Description (Optional)</label>
                <input type="text" class="detail-input" value="${item.description || ''}" placeholder="Add notes or details..."
                       onchange="updateItemDescription(${item.id}, this.value)">
            </div>
        </div>
    `).join('');
}

function removeLineItem(id) {
    lineItems = lineItems.filter(item => item.id !== id);
    renderLineItems();
    updateSummary();
}

function updateItemQuantity(id, quantity) {
    const item = lineItems.find(i => i.id === id);
    if (item) {
        item.quantity = parseInt(quantity) || 1;
        renderLineItems();
        updateSummary();
    }
}

function updateItemRate(id, rate) {
    const item = lineItems.find(i => i.id === id);
    if (item) {
        item.rate = parseFloat(rate) || 0;
        renderLineItems();
        updateSummary();
    }
}

function updateItemDescription(id, description) {
    const item = lineItems.find(i => i.id === id);
    if (item) {
        item.description = description;
    }
}

function updateSummary() {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    
    // Check if Iowa work checkbox is checked
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0; // 7% Iowa sales tax
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    document.getElementById('totalItems').textContent = lineItems.length;
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('grandTotal').textContent = `$${total.toFixed(2)}`;
    
    // Show/hide tax row
    const taxRow = document.getElementById('taxRow');
    if (iowaWork && tax > 0) {
        taxRow.style.display = 'flex';
        document.getElementById('taxAmount').textContent = `$${tax.toFixed(2)}`;
    } else {
        taxRow.style.display = 'none';
    }
}

function previewQuote() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerServices = document.getElementById('customerServices').value.trim();
    
    if (!customerName) {
        showNotification('Please enter a customer name', 'error');
        return;
    }
    
    if (lineItems.length === 0) {
        showNotification('Please add at least one line item to the quote', 'error');
        return;
    }
    
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const notes = document.getElementById('quoteNotes').value.trim();
    
    const previewHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <img src="/logo.png" alt="Helmick Underground" style="max-width: 200px; margin-bottom: 1rem;">
            <h1 style="color: #ff6b1a; margin: 0; font-size: 2rem;">Project Quote</h1>
            <p style="color: #666; margin: 0.5rem 0;">Date: ${today}</p>
        </div>

        <div style="background: #f9f9f9; border-left: 4px solid #ff6b1a; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
            <h2 style="color: #333; margin: 0 0 1rem 0; font-size: 1.3rem;">Customer Information</h2>
            <p style="margin: 0.5rem 0; color: #666;"><strong>Name:</strong> ${customerName}</p>
            ${customerEmail ? `<p style="margin: 0.5rem 0; color: #666;"><strong>Email:</strong> ${customerEmail}</p>` : ''}
            ${customerPhone ? `<p style="margin: 0.5rem 0; color: #666;"><strong>Phone:</strong> ${customerPhone}</p>` : ''}
            ${customerServices ? `<p style="margin: 0.5rem 0; color: #666;"><strong>Services:</strong> ${customerServices}</p>` : ''}
        </div>

        <h2 style="color: #ff6b1a; margin-bottom: 1rem; font-size: 1.3rem;">Quote Details</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
            <thead>
                <tr>
                    <th style="background: #f5f5f5; padding: 0.75rem; text-align: left; font-weight: 700; color: #333; border-bottom: 2px solid #ff6b1a;">Item</th>
                    <th style="background: #f5f5f5; padding: 0.75rem; text-align: center; font-weight: 700; color: #333; border-bottom: 2px solid #ff6b1a;">Quantity</th>
                    <th style="background: #f5f5f5; padding: 0.75rem; text-align: right; font-weight: 700; color: #333; border-bottom: 2px solid #ff6b1a;">Rate</th>
                    <th style="background: #f5f5f5; padding: 0.75rem; text-align: right; font-weight: 700; color: #333; border-bottom: 2px solid #ff6b1a;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${lineItems.map(item => `
                    <tr>
                        <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">
                            <strong>${item.name}</strong>
                            ${item.description ? `<br><span style="color: #666; font-size: 0.9rem;">${item.description}</span>` : ''}
                        </td>
                        <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                        <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee; font-weight: 600;">$${(item.quantity * item.rate).toFixed(2)}</td>
                    </tr>
                `).join('')}
                <tr style="border-top: 2px solid #ff6b1a;">
                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Subtotal:</td>
                    <td style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #333;">$${subtotal.toFixed(2)}</td>
                </tr>
                ${iowaWork && tax > 0 ? `
                <tr>
                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Tax (7% - Iowa):</td>
                    <td style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #ff6b1a;">$${tax.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="font-weight: 700; font-size: 1.2rem;">
                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; border-top: 3px solid #ff6b1a; color: #333;">Total:</td>
                    <td style="padding: 1rem 0.75rem; text-align: right; border-top: 3px solid #ff6b1a; color: #ff6b1a;">$${total.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        ${notes ? `
            <div style="background: #fffbf0; border-left: 4px solid #ffc107; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                <h3 style="color: #333; margin: 0 0 0.5rem 0; font-size: 1.1rem;">Additional Notes</h3>
                <p style="color: #666; margin: 0; white-space: pre-wrap;">${notes}</p>
            </div>
        ` : ''}

        <div style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #eee;">
            <p style="color: #999; margin: 0.5rem 0; font-size: 0.9rem;">Thank you for considering Helmick Underground for your project.</p>
            <p style="color: #999; margin: 0.5rem 0; font-size: 0.9rem;">Please contact us if you have any questions.</p>
        </div>

        <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); border-radius: 12px;">
            <p style="color: white; margin: 0; font-size: 1rem; font-weight: 700;">Helmick Underground</p>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 0.5rem 0; font-size: 0.9rem;">Quality Underground Utility Services</p>
            <p style="color: white; margin: 0.75rem 0 0 0; font-size: 0.9rem;">📞 Tommy Helmick: (319) 721-9925</p>
            <p style="color: white; margin: 0.25rem 0 0 0; font-size: 0.9rem;">📧 HelmickUnderground@gmail.com</p>
            <p style="color: white; margin: 0.25rem 0 0 0; font-size: 0.9rem;">🌐 www.helmickunderground.com</p>
        </div>
    `;
    
    document.getElementById('quotePreviewContent').innerHTML = previewHTML;
    document.getElementById('previewModal').style.display = 'block';
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

function printQuote() {
    const printWindow = window.open('', '', 'width=800,height=600');
    
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const notes = document.getElementById('quoteNotes')?.value || '';
    const customerName = document.getElementById('customerName')?.value || 'Customer';
    const customerEmail = document.getElementById('customerEmail')?.value || '';
    const customerPhone = document.getElementById('customerPhone')?.value || '';
    
    const printHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Quote - Helmick Underground</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            margin: 0.5in; 
            size: auto;
        }
        @media print {
            body { margin: 0; padding: 0; font-size: 10pt; }
            .no-print { display: none; }
            @page { margin: 0.5in; size: portrait; }
            html, body { height: 100%; }
            .page-wrapper { min-height: 100%; display: flex; flex-direction: column; }
            .main-content { flex: 1 0 auto; }
            .bottom-section { flex-shrink: 0; margin-top: auto; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #e5e7eb; }
        html, body { height: 100%; margin: 0; }
        .page-wrapper { min-height: 100%; display: flex; flex-direction: column; }
        .main-content { flex: 1 0 auto; }
        .bottom-section { flex-shrink: 0; margin-top: auto; }
    </style>
</head>
<body>
    <div class="page-wrapper">
    <div class="main-content" style="padding: 0.5rem; background: #1a1a1a;">
        <!-- Header with logo in corner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="width: 100px; height: auto;">
            <div style="text-align: right;">
                <div style="background: white; padding: 0.5rem 1.5rem; display: inline-block; border: 3px solid #ff6b1a; border-radius: 8px;">
                    <h2 style="color: #ff6b1a; margin: 0; font-size: 1.3rem; font-weight: 700;">QUOTE</h2>
                </div>
            </div>
        </div>
        
        <!-- From/For Section -->
        <div style="background: #2a2a2a; padding: 0.5rem; margin-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top; padding-right: 0.5rem;">
                        <h3 style="color: #ff6b1a; margin: 0 0 0.3rem 0; font-size: 0.85rem;">From:</h3>
                        <p style="margin: 0; line-height: 1.3; color: #ffffff; font-weight: 600; font-size: 0.85rem;">Helmick Underground</p>
                        <p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">498 Elbow Creek Rd, Mount Vernon, IA 52314</p>
                        <p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">HelmickUnderground@gmail.com</p>
                    </td>
                    <td style="width: 50%; vertical-align: top; padding-left: 0.5rem;">
                        <h3 style="color: #ff6b1a; margin: 0 0 0.3rem 0; font-size: 0.85rem;">Prepared For:</h3>
                        <p style="margin: 0; line-height: 1.3; color: #ffffff; font-weight: 600; font-size: 0.85rem;">${customerName}</p>
                        ${customerEmail ? `<p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">${customerEmail}</p>` : ''}
                        ${customerPhone ? `<p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">${customerPhone}</p>` : ''}
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Quote Details -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; background: #2a2a2a; border-left: 3px solid #ff6b1a;">
            <tr>
                <td style="width: 50%; padding: 0.5rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.7rem; font-weight: 600;">Quote Date:</p>
                    <p style="margin: 0.1rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 0.9rem;">${new Date().toLocaleDateString()}</p>
                </td>
                <td style="width: 50%; padding: 0.5rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.7rem; font-weight: 600;">Valid Until:</p>
                    <p style="margin: 0.1rem 0 0 0; color: #ff6b1a; font-weight: 700; font-size: 0.9rem;">${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                </td>
            </tr>
        </table>
        
        <!-- Line Items -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; background: #2a2a2a;">
            <thead>
                <tr style="background: #333; color: white;">
                    <th style="padding: 0.4rem; text-align: left; font-weight: 700; font-size: 0.85rem;">Description</th>
                    <th style="padding: 0.4rem; text-align: center; font-weight: 700; font-size: 0.85rem;">Qty</th>
                    <th style="padding: 0.4rem; text-align: right; font-weight: 700; font-size: 0.85rem;">Rate</th>
                    <th style="padding: 0.4rem; text-align: right; font-weight: 700; font-size: 0.85rem;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${lineItems.map(item => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.4rem; color: #e5e7eb; font-size: 0.85rem;">${item.name}</td>
                        <td style="padding: 0.4rem; text-align: center; color: #b0b0b0; font-size: 0.85rem;">${item.quantity}</td>
                        <td style="padding: 0.4rem; text-align: right; color: #b0b0b0; font-size: 0.85rem;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.4rem; text-align: right; color: #ffffff; font-weight: 600; font-size: 0.85rem;">$${(item.quantity * item.rate).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        ${notes ? `
        <!-- Notes Section -->
        <div style="background: #2a2a2a; padding: 0.6rem; margin-top: 0.5rem; border-left: 3px solid #ff6b1a;">
            <h3 style="color: #ff6b1a; margin: 0 0 0.3rem 0; font-size: 0.85rem;">Notes:</h3>
            <p style="margin: 0; color: #e5e7eb; font-size: 0.8rem; line-height: 1.4; white-space: pre-wrap;">${notes}</p>
        </div>
        ` : ''}
    </div>
    
    <!-- Bottom Section with Totals and Footer -->
    <div class="bottom-section" style="padding: 0.5rem; background: #1a1a1a;">
        <!-- Totals -->
        <div style="background: #2a2a2a; padding: 0.8rem; border-radius: 8px; margin-bottom: 0.5rem;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #404040;">
                    <td style="padding: 0.3rem; text-align: right; font-weight: 600; color: #b0b0b0; font-size: 0.85rem;">Subtotal:</td>
                    <td style="padding: 0.3rem; text-align: right; font-weight: 600; color: #ffffff; font-size: 0.85rem; width: 120px;">$${subtotal.toFixed(2)}</td>
                </tr>
                ${taxRate > 0 ? `
                <tr style="border-bottom: 1px solid #404040;">
                    <td style="padding: 0.3rem; text-align: right; color: #b0b0b0; font-size: 0.85rem;">Tax (${(taxRate * 100).toFixed(0)}%):</td>
                    <td style="padding: 0.3rem; text-align: right; color: #ffffff; font-size: 0.85rem;">$${tax.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);">
                    <td style="padding: 0.6rem; text-align: right; font-weight: 700; color: white; font-size: 1.1rem;">Total:</td>
                    <td style="padding: 0.6rem; text-align: right; font-weight: 700; color: white; font-size: 1.1rem;">$${total.toFixed(2)}</td>
                </tr>
            </table>
        </div>
        
        <!-- Footer -->
        <div style="padding-top: 0.5rem; border-top: 1px solid #404040; text-align: center;">
            <p style="margin: 0; color: #888; font-size: 0.75rem;">Thank you for your business!</p>
            <p style="margin: 0.2rem 0; color: #888; font-size: 0.75rem;">Questions? Contact us at HelmickUnderground@gmail.com</p>
        </div>
    </div>
    </div>
</body>
</html>
    `;
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// Download quote as PDF
async function downloadQuotePDF() {
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
        
        const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
        const taxRate = iowaWork ? 0.07 : 0;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;
        
        const customerName = document.getElementById('customerName')?.value || 'Customer';
        const customerEmail = document.getElementById('customerEmail')?.value || '';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        
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
        
        // QUOTE header
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(255, 107, 26);
        doc.setLineWidth(2);
        doc.roundedRect(pageWidth - margin - 120, yPos, 120, 35, 3, 3, 'FD');
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('QUOTE', pageWidth - margin - 60, yPos + 23, { align: 'center' });
        
        yPos += 60;
        
        // From/For Section
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 80, 3, 3, 'F');
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos + 78, pageWidth - 2 * margin, 2, 'F');
        
        // From
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('From:', margin + 15, yPos + 20);
        doc.setTextColor(0, 0, 0);
        doc.text('Helmick Underground', margin + 15, yPos + 35);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('498 Elbow Creek Rd, Mount Vernon, IA 52314', margin + 15, yPos + 48);
        doc.text('HelmickUnderground@gmail.com', margin + 15, yPos + 61);
        
        // Prepared For
        const midPoint = pageWidth / 2 + 20;
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Prepared For:', midPoint, yPos + 20);
        doc.setTextColor(0, 0, 0);
        doc.text(customerName, midPoint, yPos + 35);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        if (customerEmail) {
            doc.text(customerEmail, midPoint, yPos + 48);
        }
        if (customerPhone) {
            doc.text(customerPhone, midPoint, yPos + 61);
        }
        
        yPos += 100;
        
        // Quote Details
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 50, 3, 3, 'F');
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos, 3, 50, 'F');
        
        const detailWidth = (pageWidth - 2 * margin - 30) / 2;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Quote Date:', margin + 15, yPos + 15);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString(), margin + 15, yPos + 30);
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Valid Until:', margin + detailWidth + 15, yPos + 15);
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString(), margin + detailWidth + 15, yPos + 30);
        
        yPos += 60;
        
        // Line Items Table
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        
        // Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 30, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', margin + 10, yPos + 18);
        doc.text('Qty', pageWidth - margin - 220, yPos + 18, { align: 'center' });
        doc.text('Rate', pageWidth - margin - 140, yPos + 18, { align: 'right' });
        doc.text('Amount', pageWidth - margin - 10, yPos + 18, { align: 'right' });
        
        yPos += 30;
        
        // Table Rows
        doc.setFont('helvetica', 'normal');
        lineItems.forEach((item, index) => {
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');
            }
            
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, yPos + 25, pageWidth - margin, yPos + 25);
            
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(9);
            doc.text(item.name, margin + 10, yPos + 16);
            doc.setTextColor(80, 80, 80);
            doc.text(item.quantity.toString(), pageWidth - margin - 220, yPos + 16, { align: 'center' });
            doc.text(`$${item.rate.toFixed(2)}`, pageWidth - margin - 140, yPos + 16, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(item.quantity * item.rate).toFixed(2)}`, pageWidth - margin - 10, yPos + 16, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            
            yPos += 25;
        });
        
        // Calculate footer position (bottom of page)
        const footerHeight = 120; // Height needed for totals and footer
        const footerStartY = pageHeight - margin - footerHeight;
        
        // Use whichever is lower: current position or fixed footer position
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
        yPos += 20;
        
        // Tax
        if (taxRate > 0) {
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tax (${(taxRate * 100).toFixed(0)}%):`, pageWidth - margin - 150, yPos, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.text(`$${tax.toFixed(2)}`, pageWidth - margin - 10, yPos, { align: 'right' });
            yPos += 20;
        }
        
        // Total
        doc.setFillColor(255, 107, 26);
        doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 30, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', pageWidth - margin - 150, yPos + 13, { align: 'right' });
        doc.text(`$${total.toFixed(2)}`, pageWidth - margin - 10, yPos + 13, { align: 'right' });
        
        yPos += 50;
        
        // Footer
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 15;
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;
        doc.text('Questions? Contact us at HelmickUnderground@gmail.com', pageWidth / 2, yPos, { align: 'center' });
        
        // Save
        const filename = customerName ? `Quote-${customerName.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.pdf` : `Quote-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showNotification('Failed to generate PDF', 'error');
    }
}

// Helper function to convert logo to base64
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

async function sendQuoteEmail() {
    const customerEmail = document.getElementById('customerEmail').value.trim();
    
    if (!customerEmail) {
        showNotification('Please enter a customer email address in the Customer Information section above.', 'error');
        return;
    }
    
    if (!customerEmail.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Sending...';
    button.disabled = true;
    
    const customerName = document.getElementById('customerName').value.trim();
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    const quoteData = {
        lineItems: lineItems,
        notes: document.getElementById('quoteNotes').value,
        iowaWork: iowaWork,
        taxRate: taxRate,
        tax: tax,
        subtotal: subtotal,
        total: total
    };
    
    try {
        const response = await fetch('/api/send-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: customerEmail,
                customerName: customerName,
                quoteData: quoteData
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to send email:', response.status, errorData);
            showNotification('Failed to send email. Please try again.', 'error');
        } else {
            showNotification(`Quote sent successfully to ${customerEmail}!`, 'success');
            closePreview();
        }
    } catch (error) {
        console.error('Error sending quote:', error);
        showNotification('Failed to send quote email. Please try again.', 'error');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Load data on page load
loadData();

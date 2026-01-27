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
    const content = document.getElementById('quotePreviewContent').innerHTML;
    const printWindow = window.open('', '', 'width=800,height=600');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quote - Helmick Underground</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 2rem;
                    max-width: 800px;
                    margin: 0 auto;
                }
                @media print {
                    body { padding: 0; }
                }
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

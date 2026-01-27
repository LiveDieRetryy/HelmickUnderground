// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

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

// Get submission ID from URL
const urlParams = new URLSearchParams(window.location.search);
const submissionId = urlParams.get('id');

let currentSubmission = null;
let ratesData = null;
let lineItems = [];
let currentCategory = 'baseRates';

// Load data
async function loadData() {
    if (!submissionId) {
        showNotification('No submission ID provided', 'error');
        window.location.href = '/admin/inbox.html';
        return;
    }

    try {
        // Load submission data
        const submissionRes = await fetch('/api/contact-submissions?action=all');
        const allSubmissions = await submissionRes.json();
        currentSubmission = allSubmissions.find(s => s.id == submissionId);

        if (!currentSubmission) {
            showNotification('Submission not found', 'error');
            window.location.href = '/admin/inbox.html';
            return;
        }

        // Load rates data
        const ratesRes = await fetch('/rates-data.json');
        ratesData = await ratesRes.json();

        // Render customer info
        renderCustomerInfo();
        
        // Render rates
        showCategory('baseRates');

    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Failed to load data', 'error');
    }
}

// Render customer information
function renderCustomerInfo() {
    document.getElementById('customerName').textContent = currentSubmission.name;
    
    const scheduledDate = currentSubmission.scheduled_date ? 
        new Date(currentSubmission.scheduled_date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : 
        'Not scheduled';

    document.getElementById('customerInfo').innerHTML = `
        <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${currentSubmission.name}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${currentSubmission.email}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${currentSubmission.phone || 'Not provided'}</span>
        </div>
        ${currentSubmission.services && currentSubmission.services.length > 0 ? `
            <div class="info-row">
                <span class="info-label">Services Requested:</span>
                <span class="info-value">${currentSubmission.services.join(', ')}</span>
            </div>
        ` : ''}
        <div class="info-row">
            <span class="info-label">Scheduled Meeting:</span>
            <span class="info-value">${scheduledDate}</span>
        </div>
        ${currentSubmission.notes ? `
            <div class="info-row">
                <span class="info-label">Contact Notes:</span>
                <span class="info-value" style="white-space: pre-wrap;">${currentSubmission.notes}</span>
            </div>
        ` : ''}
    `;
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
    else if (category === 'custom') tabs[3].classList.add('active');
    
    if (category === 'custom') {
        renderCustomForm();
    } else {
        renderRates();
    }
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
        <button class="rate-button" onclick="addLineItem('${rate.id}', '${rate.name}', ${rate.rate})">
            <span class="rate-name">${rate.name}</span>
            <span class="rate-price">$${rate.rate.toFixed(2)}</span>
        </button>
    `).join('');
}

// Render custom line item form
function renderCustomForm() {
    document.getElementById('ratesContainer').innerHTML = `
        <div style="background: rgba(255, 107, 26, 0.05); border: 2px solid rgba(255, 107, 26, 0.3); border-radius: 12px; padding: 2rem;">
            <h3 style="color: var(--primary-color); margin-bottom: 1.5rem; font-size: 1.2rem;">Create Custom Line Item</h3>
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Item Name *</label>
                    <input type="text" id="customItemName" placeholder="e.g., Special excavation work" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Rate ($) *</label>
                        <input type="number" id="customItemRate" placeholder="0.00" min="0" step="0.01" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                    </div>
                    <div>
                        <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Quantity *</label>
                        <input type="number" id="customItemQuantity" placeholder="1" min="0" step="0.01" value="1" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem;">
                    </div>
                </div>
                <div>
                    <label style="display: block; color: var(--gray); margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Description (Optional)</label>
                    <textarea id="customItemDescription" placeholder="Add any additional details..." style="width: 100%; min-height: 80px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--white); font-size: 1rem; font-family: inherit; resize: vertical;"></textarea>
                </div>
                <button onclick="addCustomLineItem()" style="background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); border: none; padding: 1rem 2rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;">
                    ➕ Add Custom Item
                </button>
            </div>
        </div>
    `;
}

// Add line item
function addLineItem(id, name, rate) {
    const lineItem = {
        id: Date.now() + Math.random(), // Unique ID
        rateId: id,
        name: name,
        rate: rate,
        quantity: 1,
        description: ''
    };
    
    lineItems.push(lineItem);
    renderLineItems();
    updateSummary();
}

// Add custom line item
function addCustomLineItem() {
    const name = document.getElementById('customItemName').value.trim();
    const rate = parseFloat(document.getElementById('customItemRate').value);
    const quantity = parseFloat(document.getElementById('customItemQuantity').value);
    const description = document.getElementById('customItemDescription').value.trim();
    
    if (!name) {
        showNotification('Please enter an item name', 'error');
        return;
    }
    
    if (isNaN(rate) || rate < 0) {
        showNotification('Please enter a valid rate', 'error');
        return;
    }
    
    if (isNaN(quantity) || quantity < 0) {
        showNotification('Please enter a valid quantity', 'error');
        return;
    }
    
    const lineItem = {
        id: Date.now() + Math.random(),
        rateId: 'custom_' + Date.now(),
        name: name,
        rate: rate,
        quantity: quantity,
        description: description
    };
    
    lineItems.push(lineItem);
    renderLineItems();
    updateSummary();
    
    // Clear form
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemRate').value = '';
    document.getElementById('customItemQuantity').value = '1';
    document.getElementById('customItemDescription').value = '';
    
    // Show success message
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Added!';
    button.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = 'linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%)';
    }, 1500);
}

// Remove line item
function removeLineItem(id) {
    lineItems = lineItems.filter(item => item.id !== id);
    renderLineItems();
    updateSummary();
}

// Update line item
function updateLineItem(id, field, value) {
    const item = lineItems.find(item => item.id === id);
    if (item) {
        if (field === 'quantity' || field === 'rate') {
            item[field] = parseFloat(value) || 0;
        } else {
            item[field] = value;
        }
        renderLineItems();
        updateSummary();
    }
}

// Render line items
function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    
    if (lineItems.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--gray); padding: 3rem;">
                No items added yet. Click on a rate above to add it to the quote.
            </div>
        `;
        return;
    }

    container.innerHTML = lineItems.map(item => {
        const total = item.quantity * item.rate;
        return `
            <div class="line-item">
                <div class="line-item-header">
                    <div class="line-item-name">${item.name}</div>
                    <button class="remove-btn" onclick="removeLineItem(${item.id})">✕</button>
                </div>
                <div class="line-item-inputs">
                    <div class="input-group">
                        <label class="input-label">Quantity</label>
                        <input 
                            type="number" 
                            class="line-item-input" 
                            value="${item.quantity}" 
                            min="0"
                            step="0.01"
                            onchange="updateLineItem(${item.id}, 'quantity', this.value)"
                        >
                    </div>
                    <div class="input-group">
                        <label class="input-label">Rate ($)</label>
                        <input 
                            type="number" 
                            class="line-item-input" 
                            value="${item.rate}" 
                            min="0"
                            step="0.01"
                            onchange="updateLineItem(${item.id}, 'rate', this.value)"
                        >
                    </div>
                    <div class="input-group">
                        <label class="input-label">Total</label>
                        <input 
                            type="text" 
                            class="line-item-input" 
                            value="$${total.toFixed(2)}" 
                            readonly
                            style="background: rgba(255, 107, 26, 0.1); border-color: var(--primary-color);"
                        >
                    </div>
                </div>
                <div class="input-group" style="margin-top: 1rem;">
                    <label class="input-label">Description / Notes (Optional)</label>
                    <input 
                        type="text" 
                        class="line-item-input" 
                        value="${item.description}" 
                        placeholder="Add details about this line item..."
                        onchange="updateLineItem(${item.id}, 'description', this.value)"
                    >
                </div>
            </div>
        `;
    }).join('');
}

// Update summary
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

// Render custom item form
function renderCustomItemForm() {
    document.getElementById('ratesContainer').innerHTML = `
        <div class="custom-item-form">
            <div>
                <label>Item Name *</label>
                <input type="text" id="customItemName" placeholder="e.g., Site Survey, Equipment Rental" />
            </div>
            <div>
                <label>Rate/Price ($) *</label>
                <input type="number" id="customItemRate" placeholder="0.00" step="0.01" min="0" />
            </div>
            <div>
                <label>Description (Optional)</label>
                <input type="text" id="customItemDescription" placeholder="Additional details about this item" />
            </div>
            <button class="add-item-btn" onclick="addCustomLineItem()">
                + Add Custom Item to Quote
            </button>
        </div>
    `;
}

// Add custom line item
function addCustomLineItem() {
    const name = document.getElementById('customItemName').value.trim();
    const rate = parseFloat(document.getElementById('customItemRate').value);
    const description = document.getElementById('customItemDescription').value.trim();
    
    if (!name || !rate || rate <= 0) {
        showNotification('Please enter a valid item name and rate', 'error');
        return;
    }
    
    const lineItem = {
        id: Date.now() + Math.random(),
        rateId: 'custom',
        name: name,
        rate: rate,
        quantity: 1,
        description: description
    };
    
    lineItems.push(lineItem);
    
    // Clear form
    document.getElementById('customItemName').value = '';
    document.getElementById('customItemRate').value = '';
    document.getElementById('customItemDescription').value = '';
    
    renderLineItems();
    updateSummary();
    
    // Switch back to base rates tab
    showCategory('baseRates');
}

// Preview quote
function previewQuote() {
    if (lineItems.length === 0) {
        showNotification('Please add at least one line item to the quote', 'error');
        return;
    }

    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const quoteNotes = document.getElementById('quoteNotes').value;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const previewHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <img src="../logo.png" alt="Helmick Underground" style="max-width: 200px; margin-bottom: 1rem;">
            <h1 style="color: #ff6b1a; font-size: 2rem; margin: 0;">Project Quote</h1>
            <p style="color: #666; margin: 0.5rem 0 0 0;">Date: ${today}</p>
        </div>

        <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border-left: 4px solid #ff6b1a;">
            <h2 style="color: #333; font-size: 1.3rem; margin: 0 0 1rem 0;">Customer Information</h2>
            <div style="color: #666; line-height: 1.8;">
                <strong style="color: #333;">${currentSubmission.name}</strong><br>
                ${currentSubmission.email}<br>
                ${currentSubmission.phone || 'No phone provided'}
                ${currentSubmission.services && currentSubmission.services.length > 0 ? `<br><strong style="color: #333;">Services:</strong> ${currentSubmission.services.join(', ')}` : ''}
            </div>
        </div>

        <div style="margin-bottom: 2rem;">
            <h2 style="color: #333; font-size: 1.3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a;">Quote Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        <th style="padding: 0.75rem; text-align: left; color: #333; border-bottom: 2px solid #ddd;">Item</th>
                        <th style="padding: 0.75rem; text-align: center; color: #333; border-bottom: 2px solid #ddd;">Quantity</th>
                        <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ddd;">Rate</th>
                        <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ddd;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineItems.map(item => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 1rem 0.75rem;">
                                <strong style="color: #333;">${item.name}</strong>
                                ${item.description ? `<br><span style="color: #666; font-size: 0.9rem;">${item.description}</span>` : ''}
                            </td>
                            <td style="padding: 1rem 0.75rem; text-align: center; color: #666;">${item.quantity}</td>
                            <td style="padding: 1rem 0.75rem; text-align: right; color: #666;">$${item.rate.toFixed(2)}</td>
                            <td style="padding: 1rem 0.75rem; text-align: right; color: #333; font-weight: 600;">$${(item.quantity * item.rate).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #ff6b1a;">
                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Subtotal:</td>
                        <td style="padding: 1rem 0.75rem; text-align: right; color: #333; font-weight: 600;">$${subtotal.toFixed(2)}</td>
                    </tr>
                    ${iowaWork && tax > 0 ? `
                    <tr>
                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #666;">Tax (7% - Iowa):</td>
                        <td style="padding: 1rem 0.75rem; text-align: right; color: #ff6b1a; font-weight: 600;">$${tax.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr style="background: #fff3e6; font-size: 1.3rem; font-weight: 700;">
                        <td colspan="3" style="padding: 1.25rem 0.75rem; text-align: right; color: #333; border-top: 3px solid #ff6b1a;">Total:</td>
                        <td style="padding: 1.25rem 0.75rem; text-align: right; color: #ff6b1a; border-top: 3px solid #ff6b1a;">$${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        ${quoteNotes ? `
            <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border-left: 4px solid #ff6b1a;">
                <h3 style="color: #333; font-size: 1.1rem; margin: 0 0 0.75rem 0;">Additional Notes</h3>
                <div style="color: #666; white-space: pre-wrap; line-height: 1.6;">${quoteNotes}</div>
            </div>
        ` : ''}

        <div style="text-align: center; padding: 2rem 0; border-top: 2px solid #eee; margin-top: 2rem;">
            <p style="color: #666; margin: 0; font-size: 0.9rem;">Thank you for considering Helmick Underground for your project.</p>
            <p style="color: #666; margin: 0.5rem 0 0 0; font-size: 0.9rem;">Please contact us if you have any questions.</p>
        </div>
    `;

    document.getElementById('quotePreviewContent').innerHTML = previewHTML;
    document.getElementById('previewModal').style.display = 'block';
}

// Close preview
function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

// Save and send quote
async function saveAndSendQuote() {
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Sending...';
    button.disabled = true;

    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const iowaWork = document.getElementById('iowaWorkCheckbox')?.checked || false;
    const taxRate = iowaWork ? 0.07 : 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    const quoteData = {
        submissionId: submissionId,
        customer: {
            name: currentSubmission.name,
            email: currentSubmission.email,
            phone: currentSubmission.phone
        },
        lineItems: lineItems,
        notes: document.getElementById('quoteNotes').value,
        iowaWork: iowaWork,
        taxRate: taxRate,
        tax: tax,
        subtotal: subtotal,
        total: total,
        createdAt: new Date().toISOString()
    };

    try {
        // Update submission with quote data and change status to "quoted"
        const updateRes = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: submissionId,
                status: 'quoted',
                quote_data: JSON.stringify(quoteData)
            })
        });

        if (!updateRes.ok) throw new Error('Failed to update submission');

        // Send quote email via API
        const emailRes = await fetch('/api/send-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: currentSubmission.email,
                customerName: currentSubmission.name,
                quoteData: quoteData
            })
        });

        if (!emailRes.ok) {
            const errorData = await emailRes.json().catch(() => ({}));
            console.error('Failed to send email:', emailRes.status, errorData);
            showSuccessMessage('Quote saved successfully, but failed to send email. You can resend it from the inbox.', true);
        } else {
            showSuccessMessage('Quote sent successfully! The customer will receive the quote via email.', false);
        }

    } catch (error) {
        console.error('Error saving quote:', error);
        showSuccessMessage('Failed to save quote. Please try again.', true);
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function showSuccessMessage(message, isError) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background: white; border-radius: 20px; padding: 3rem; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);';
    
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size: 4rem; margin-bottom: 1rem;';
    icon.textContent = isError ? '⚠️' : '✅';
    
    const text = document.createElement('p');
    text.style.cssText = 'font-size: 1.2rem; color: #333; margin-bottom: 2rem;';
    text.textContent = message;
    
    const button = document.createElement('button');
    button.style.cssText = 'background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white; border: none; padding: 1rem 2rem; border-radius: 12px; font-size: 1.1rem; font-weight: 700; cursor: pointer;';
    button.textContent = 'OK';
    button.onclick = () => {
        if (!isError) {
            window.location.href = '/admin/inbox.html';
        } else {
            modal.remove();
        }
    };
    
    content.appendChild(icon);
    content.appendChild(text);
    content.appendChild(button);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

// Load data on page load
loadData();

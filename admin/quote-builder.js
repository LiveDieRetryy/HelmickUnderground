// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/';
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = '/admin/';
});

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
        alert('No submission ID provided');
        window.location.href = '/admin/inbox.html';
        return;
    }

    try {
        // Load submission data
        const submissionRes = await fetch('/api/contact-submissions?action=all');
        const allSubmissions = await submissionRes.json();
        currentSubmission = allSubmissions.find(s => s.id == submissionId);

        if (!currentSubmission) {
            alert('Submission not found');
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
        alert('Failed to load data');
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
    event?.target.classList.add('active');
    
    renderRates();
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
    
    document.getElementById('totalItems').textContent = lineItems.length;
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('grandTotal').textContent = `$${subtotal.toFixed(2)}`;
}

// Save quote
async function saveQuote() {
    if (lineItems.length === 0) {
        alert('Please add at least one line item to the quote');
        return;
    }

    if (!confirm('Save this quote and mark the request as "Quoted"?')) {
        return;
    }

    const quoteData = {
        submissionId: submissionId,
        customer: {
            name: currentSubmission.name,
            email: currentSubmission.email,
            phone: currentSubmission.phone
        },
        lineItems: lineItems,
        notes: document.getElementById('quoteNotes').value,
        subtotal: lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0),
        createdAt: new Date().toISOString()
    };

    try {
        // Save quote (you can create an API endpoint for this later)
        // For now, we'll just store it in localStorage and update the submission status
        
        // Get existing quotes or create new array
        const existingQuotes = JSON.parse(localStorage.getItem('quotes') || '[]');
        existingQuotes.push(quoteData);
        localStorage.setItem('quotes', JSON.stringify(existingQuotes));

        // Update submission status to "quoted"
        const updateRes = await fetch('/api/contact-submissions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: submissionId,
                status: 'quoted'
            })
        });

        if (!updateRes.ok) throw new Error('Failed to update status');

        alert('Quote saved successfully! Redirecting to inbox...');
        window.location.href = '/admin/inbox.html';

    } catch (error) {
        console.error('Error saving quote:', error);
        alert('Failed to save quote. Please try again.');
    }
}

// Initialize active tab on category switch
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
    
    renderRates();
}

// Load data on page load
loadData();

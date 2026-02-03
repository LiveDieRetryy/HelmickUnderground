// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let customers = [];
let currentCustomerIndex = null;

// Load customer details
function loadCustomerDetails() {
    // Get customer ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');
    
    if (customerId === null) {
        window.location.href = 'customers.html';
        return;
    }
    
    currentCustomerIndex = parseInt(customerId);
    
    // Load customers from localStorage
    const saved = localStorage.getItem('customers');
    customers = saved ? JSON.parse(saved) : [];
    
    if (currentCustomerIndex < 0 || currentCustomerIndex >= customers.length) {
        alert('Customer not found');
        window.location.href = 'customers.html';
        return;
    }
    
    const customer = customers[currentCustomerIndex];
    displayCustomer(customer);
}

// Display customer information
function displayCustomer(customer) {
    // Customer name and type
    document.getElementById('customerName').textContent = customer.name;
    
    const typeBadge = document.getElementById('customerTypeBadge');
    typeBadge.textContent = customer.type;
    
    const typeColors = {
        'Residential': '#3b82f6',
        'Commercial': '#10b981',
        'Municipal': '#f59e0b',
        'Industrial': '#8b5cf6',
        'Agricultural': '#22c55e',
        'Other': '#6b7280'
    };
    
    const typeColor = typeColors[customer.type] || '#ff6b1a';
    typeBadge.style.background = `${typeColor}33`;
    typeBadge.style.color = typeColor;
    typeBadge.style.border = `2px solid ${typeColor}`;
    
    // Contact information
    let contactHtml = '';
    
    if (customer.contactPerson) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Contact Person</div>
                <div class="info-value">${customer.contactPerson}</div>
            </div>
        `;
    }
    
    contactHtml += `
        <div class="info-box">
            <div class="info-label">Phone</div>
            <div class="info-value"><a href="tel:${customer.phone}">${customer.phone}</a></div>
        </div>
    `;
    
    if (customer.email) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Email</div>
                <div class="info-value"><a href="mailto:${customer.email}">${customer.email}</a></div>
            </div>
        `;
    }
    
    if (customer.preferredContact) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Preferred Contact</div>
                <div class="info-value" style="text-transform: capitalize;">${customer.preferredContact}</div>
            </div>
        `;
    }
    
    if (customer.address || customer.city || customer.state || customer.zip) {
        const addressParts = [customer.address, customer.city, customer.state, customer.zip].filter(Boolean);
        contactHtml += `
            <div class="info-box" style="grid-column: 1 / -1;">
                <div class="info-label">Address</div>
                <div class="info-value">${addressParts.join(', ')}</div>
            </div>
        `;
    }
    
    document.getElementById('contactInfo').innerHTML = contactHtml;
    
    // Stats section
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${customer.totalJobs || 0}</div>
            <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${customer.lastJob || 'Never'}</div>
            <div class="stat-label">Last Job</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${customer.customLineItems ? customer.customLineItems.length : 0}</div>
            <div class="stat-label">Custom Rates</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${new Date(customer.created || Date.now()).toLocaleDateString()}</div>
            <div class="stat-label">Customer Since</div>
        </div>
    `;
    
    document.getElementById('statsSection').innerHTML = statsHtml;
    
    // Notes section
    if (customer.notes) {
        document.getElementById('notesSection').style.display = 'block';
        document.getElementById('notesContent').textContent = customer.notes;
    }
    
    // Custom line items section
    if (customer.customLineItems && customer.customLineItems.length > 0) {
        document.getElementById('lineItemsSection').style.display = 'block';
        
        const lineItemsHtml = customer.customLineItems.map(item => `
            <tr>
                <td style="color: var(--white); font-weight: 500;">${item.description}</td>
                <td style="color: var(--primary-color); font-weight: 700;">$${item.rate.toFixed(2)}</td>
            </tr>
        `).join('');
        
        document.getElementById('lineItemsTable').innerHTML = lineItemsHtml;
    }
}

// Edit customer
function editCustomer() {
    window.location.href = `customers.html?edit=${currentCustomerIndex}`;
}

// Create invoice for customer
function createInvoice() {
    const customer = customers[currentCustomerIndex];
    
    // Store customer data in sessionStorage
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        contactPerson: customer.contactPerson,
        customLineItems: customer.customLineItems || []
    }));
    
    // Redirect to invoice page
    window.location.href = 'create-invoice.html';
}

// Delete customer
function deleteCustomer() {
    const customer = customers[currentCustomerIndex];
    
    if (confirm(`Are you sure you want to delete ${customer.name}?\n\nThis will permanently remove this customer from your database.`)) {
        customers.splice(currentCustomerIndex, 1);
        localStorage.setItem('customers', JSON.stringify(customers));
        
        alert('Customer deleted successfully');
        window.location.href = 'customers.html';
    }
}

// Initialize on page load
loadCustomerDetails();

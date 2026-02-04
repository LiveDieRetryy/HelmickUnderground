// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let customers = [];
let currentEditingIndex = null;

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : type === 'info' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
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
    if (!document.querySelector('style[data-notification]')) {
        style.setAttribute('data-notification', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Load customers from localStorage
function loadCustomers() {
    try {
        const saved = localStorage.getItem('customers');
        customers = saved ? JSON.parse(saved) : [];
        
        // Ensure all customers have customLineItems array (for backwards compatibility)
        customers = customers.map(customer => ({
            ...customer,
            customLineItems: customer.customLineItems || []
        }));
        
        // Sort by name
        customers.sort((a, b) => a.name.localeCompare(b.name));
        
        displayCustomers();
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
        showNotification('Error loading customers. Starting fresh.', 'error');
        displayCustomers();
    }
}

// Save customers to localStorage
function saveCustomers() {
    localStorage.setItem('customers', JSON.stringify(customers));
}

// Display all customers
function displayCustomers(searchTerm = '') {
    const container = document.getElementById('customersContainer');
    
    let filteredCustomers = customers;
    
    // Filter by search term
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredCustomers = customers.filter(customer => 
            customer.name.toLowerCase().includes(search) ||
            (customer.contactPerson && customer.contactPerson.toLowerCase().includes(search)) ||
            (customer.phone && customer.phone.includes(search)) ||
            (customer.email && customer.email.toLowerCase().includes(search)) ||
            (customer.city && customer.city.toLowerCase().includes(search))
        );
    }
    
    if (filteredCustomers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3 style="color: var(--white); margin-bottom: 0.5rem;">${searchTerm ? 'No Customers Found' : 'No Customers Yet'}</h3>
                <p style="color: var(--gray);">${searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredCustomers.map((customer, index) => {
        const actualIndex = customers.indexOf(customer);
        const typeColors = {
            residential: '#10b981',
            commercial: '#3b82f6',
            municipal: '#8b5cf6',
            contractor: '#f59e0b'
        };
        
        const typeColor = typeColors[customer.type] || '#ff6b1a';
        
        return `
            <div class="customer-card" onclick="viewCustomerDetails(${actualIndex})" style="cursor: pointer;">
                <div class="customer-header">
                    <div style="flex: 1;">
                        <h3 class="customer-name">${customer.name}</h3>
                        <span class="customer-type" style="background: ${typeColor}33; color: ${typeColor};">
                            ${customer.type}
                        </span>
                    </div>
                    <div class="customer-actions" onclick="event.stopPropagation()">
                        <button onclick="editCustomer(${actualIndex})" class="btn-icon" title="Edit">
                            ✏️
                        </button>
                        <button onclick="createInvoiceForCustomer(${actualIndex})" class="btn-icon" title="Create Invoice" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #10b981;">
                            📄
                        </button>
                        <button onclick="deleteCustomer(${actualIndex})" class="btn-icon delete" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="customer-info">
                    ${customer.contactPerson ? `<div class="customer-info-row"><span class="customer-info-label">Contact:</span> ${customer.contactPerson}</div>` : ''}
                    <div class="customer-info-row"><span class="customer-info-label">Phone:</span> <a href="tel:${customer.phone}" style="color: var(--primary-color);">${customer.phone}</a></div>
                    ${customer.email ? `<div class="customer-info-row"><span class="customer-info-label">Email:</span> <a href="mailto:${customer.email}" style="color: var(--primary-color);">${customer.email}</a></div>` : ''}
                    ${customer.address || customer.city || customer.state || customer.zip ? `
                        <div class="customer-info-row">
                            <span class="customer-info-label">Address:</span> 
                            ${[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}
                        </div>
                    ` : ''}
                    ${customer.preferredContact ? `<div class="customer-info-row"><span class="customer-info-label">Prefer:</span> ${customer.preferredContact}</div>` : ''}
                </div>
                
                <div class="customer-stats">
                    <div class="stat-box">
                        <div class="stat-value">${customer.totalJobs || 0}</div>
                        <div class="stat-label">Jobs</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${customer.lastJob || 'Never'}</div>
                        <div class="stat-label">Last Job</div>
                    </div>
                </div>
                
                ${customer.notes ? `<div class="customer-notes">${customer.notes}</div>` : ''}
                
                ${customer.customLineItems && customer.customLineItems.length > 0 ? `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255, 107, 26, 0.1); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 10px; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.2rem;">💰</span>
                        <span style="color: var(--primary-color); font-weight: 600; font-size: 0.9rem;">${customer.customLineItems.length} Custom Line Item${customer.customLineItems.length > 1 ? 's' : ''}</span>
                    </div>
                ` : ''}
                
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 107, 26, 0.15); color: var(--gray); font-size: 0.85rem;">
                    Added: ${new Date(customer.created || Date.now()).toLocaleDateString()}
                </div>
            </div>
        `;
    }).join('');
}

// Open modal to add new customer
function openAddCustomerModal() {
    currentEditingIndex = null;
    document.getElementById('modalTitle').textContent = 'Add Customer';
    document.getElementById('customerForm').reset();
    document.getElementById('customerState').value = 'IA'; // Default to Iowa
    
    // Clear line items table
    const tableBody = document.getElementById('customLineItemsTable');
    tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--gray);">No custom line items added yet</td></tr>';
    
    document.getElementById('customerModal').style.display = 'block';
}

// Open modal to edit existing customer
function editCustomer(index) {
    currentEditingIndex = index;
    const customer = customers[index];
    
    document.getElementById('modalTitle').textContent = 'Edit Customer';
    document.getElementById('customerType').value = customer.type;
    document.getElementById('customerName').value = customer.name;
    document.getElementById('contactPerson').value = customer.contactPerson || '';
    document.getElementById('customerPhone').value = customer.phone;
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerCity').value = customer.city || '';
    document.getElementById('customerState').value = customer.state || 'IA';
    document.getElementById('customerZip').value = customer.zip || '';
    document.getElementById('preferredContact').value = customer.preferredContact || 'phone';
    document.getElementById('customerNotes').value = customer.notes || '';
    
    // Populate custom line items table
    const tableBody = document.getElementById('customLineItemsTable');
    tableBody.innerHTML = '';
    
    if (customer.customLineItems && customer.customLineItems.length > 0) {
        customer.customLineItems.forEach(item => {
            addCustomLineItemRow(item.description, item.rate);
        });
    } else {
        tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--gray);">No custom line items added yet</td></tr>';
    }
    
    document.getElementById('customerModal').style.display = 'block';
}

// Close customer modal
function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
    currentEditingIndex = null;
}

// Delete customer
function deleteCustomer(index) {
    const customer = customers[index];
    
    if (confirm(`Are you sure you want to delete ${customer.name}?\n\nThis will permanently remove this customer from your database.`)) {
        customers.splice(index, 1);
        saveCustomers();
        displayCustomers();
        showNotification('Customer deleted successfully', 'success');
    }
}

// Create invoice for customer (redirects to invoice page with pre-filled data)
function createInvoiceForCustomer(index) {
    const customer = customers[index];
    
    // Store customer data in sessionStorage to pre-fill invoice
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: customer.name,
        contactPerson: customer.contactPerson,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        customLineItems: customer.customLineItems || []
    }));
    
    // Redirect to invoice creation page
    window.location.href = 'create-invoice.html';
}

// Handle form submission
document.getElementById('customerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Parse custom line items from table
    const customLineItems = [];
    const rows = document.querySelectorAll('#customLineItemsTable tr');
    
    rows.forEach(row => {
        const descInput = row.querySelector('.line-item-input:not(.line-item-rate)');
        const rateInput = row.querySelector('.line-item-rate');
        
        if (descInput && rateInput) {
            const description = descInput.value.trim();
            const rate = parseFloat(rateInput.value);
            
            if (description && !isNaN(rate) && rate > 0) {
                customLineItems.push({ description, rate });
            }
        }
    });
    
    const customerData = {
        type: document.getElementById('customerType').value,
        name: document.getElementById('customerName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        phone: document.getElementById('customerPhone').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        address: document.getElementById('customerAddress').value.trim(),
        city: document.getElementById('customerCity').value.trim(),
        state: document.getElementById('customerState').value.trim(),
        zip: document.getElementById('customerZip').value.trim(),
        preferredContact: document.getElementById('preferredContact').value,
        notes: document.getElementById('customerNotes').value.trim(),
        customLineItems: customLineItems,
        totalJobs: currentEditingIndex !== null ? customers[currentEditingIndex].totalJobs : 0,
        lastJob: currentEditingIndex !== null ? customers[currentEditingIndex].lastJob : 'Never',
        created: currentEditingIndex !== null ? customers[currentEditingIndex].created : new Date().toISOString()
    };
    
    if (currentEditingIndex !== null) {
        // Update existing customer
        customers[currentEditingIndex] = customerData;
        showNotification('Customer updated successfully', 'success');
    } else {
        // Add new customer
        customers.push(customerData);
        showNotification('Customer added successfully', 'success');
    }
    
    saveCustomers();
    displayCustomers();
    closeCustomerModal();
});

// Search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    displayCustomers(e.target.value);
});

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
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('customerModal');
    if (e.target === modal) {
        closeCustomerModal();
    }
});

// Add a new line item row to the table
function addCustomLineItemRow(description = '', rate = '') {
    const tableBody = document.getElementById('customLineItemsTable');
    
    // Remove empty state message if present
    if (tableBody.querySelector('td[colspan="3"]')) {
        tableBody.innerHTML = '';
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td style="padding: 0.75rem;">
            <input type="text" class="line-item-input" placeholder="Enter description..." value="${description}" required>
        </td>
        <td style="padding: 0.75rem;">
            <input type="number" class="line-item-input line-item-rate" placeholder="0.00" step="0.01" min="0" value="${rate}" required>
        </td>
        <td style="padding: 0.75rem; text-align: center;">
            <button type="button" class="delete-line-item-btn" onclick="removeCustomLineItemRow(this)">
                🗑️ Delete
            </button>
        </td>
    `;
    
    tableBody.appendChild(row);
}

// Remove a line item row from the table
function removeCustomLineItemRow(btn) {
    const row = btn.closest('tr');
    const tableBody = document.getElementById('customLineItemsTable');
    
    row.remove();
    
    // If no rows left, show empty state
    if (tableBody.querySelectorAll('tr').length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--gray);">No custom line items added yet</td></tr>';
    }
}

// View customer details page
function viewCustomerDetails(index) {
    window.location.href = `customer-details.html?id=${index}`;
}

// Initialize on page load
function initializePage() {
    loadCustomers();
    
    // Check if coming from customer details page with edit parameter
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId !== null) {
        const index = parseInt(editId);
        if (index >= 0 && index < customers.length) {
            editCustomer(index);
        }
    }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

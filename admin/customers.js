// Check auth (using shared utility)
checkAuth();

let customers = [];
let currentEditingIndex = null;
let currentPage = 1;
let itemsPerPage = 25;
let totalPages = 1;
let totalCustomers = 0;
let customerSearch = null; // Fuzzy search instance

/**
 * Load customers from database with pagination
 * @param {number} [page=currentPage] - Page number to load (1-indexed)
 * @returns {Promise<void>}
 * @throws {Error} If API request fails
 * @example
 * await loadCustomers(1); // Load first page
 */
async function loadCustomers(page = currentPage) {
    const container = document.getElementById('customersContainer');
    
    // Show loading state
    if (container) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--gray);">
                <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(255, 107, 26, 0.3); border-radius: 50%; border-top-color: var(--primary-color); animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
                <div style="font-size: 1.1rem;">Loading customers...</div>
            </div>
        `;
    }
    
    try {
        const response = await fetch(`/api/customers?action=all&page=${page}&limit=${itemsPerPage}`);
        if (!response.ok) throw new Error('Failed to load customers');
        
        const data = await response.json();
        
        // Handle both old (array) and new (object with pagination) response formats
        if (Array.isArray(data)) {
            // Old format - no pagination
            customers = data;
            totalCustomers = data.length;
            totalPages = 1;
            currentPage = 1;
        } else {
            // New format - with pagination
            customers = data.customers || [];
            currentPage = data.pagination.page;
            totalPages = data.pagination.totalPages;
            totalCustomers = data.pagination.totalCount;
        }
        
        // Ensure all customers have custom_line_items array (for backwards compatibility)
        customers = customers.map(customer => ({
            ...customer,
            customLineItems: customer.custom_line_items || []
        }));
        
        // Initialize fuzzy search if SearchEnhancer is available
        if (typeof initCustomerSearch !== 'undefined') {
            customerSearch = initCustomerSearch(customers);
        }
        
        displayCustomers();
        updatePaginationControls();
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
        showNotification('Error loading customers from database.', 'error');
        displayCustomers();
    }
}

/**
 * Display customers in grid with optional search filtering using fuzzy search
 * @param {string} [searchTerm=''] - Search term to filter customers by name, contact, phone, email, or city
 * @returns {void}
 * @example
 * displayCustomers(); // Show all customers
 * displayCustomers('john'); // Show customers matching 'john'
 */
function displayCustomers(searchTerm = '') {
    const container = document.getElementById('customersContainer');
    
    let filteredCustomers = customers;
    let searchStats = null;
    
    // Use fuzzy search if available and search term provided
    if (searchTerm && customerSearch) {
        const results = customerSearch.searchWithHighlights(searchTerm);
        filteredCustomers = results.map(r => ({
            ...r,
            // Remove search metadata for display
            _score: undefined,
            _matches: undefined
        }));
        searchStats = customerSearch.getSearchStats(results);
    } else if (searchTerm) {
        // Fallback to basic search
        const search = searchTerm.toLowerCase();
        filteredCustomers = customers.filter(customer => 
            customer.name.toLowerCase().includes(search) ||
            (customer.contact_person && customer.contact_person.toLowerCase().includes(search)) ||
            (customer.phone && customer.phone.includes(search)) ||
            (customer.email && customer.email.toLowerCase().includes(search)) ||
            (customer.city && customer.city.toLowerCase().includes(search))
        );
    }
    
    // Show search stats if available
    let statsHtml = '';
    if (searchStats && searchTerm) {
        statsHtml = `
            <div class="search-stats" style="grid-column: 1 / -1;">
                Found <strong>${searchStats.matches}</strong> of <strong>${searchStats.total}</strong> customers matching "<strong>${searchTerm}</strong>"
            </div>
        `;
    }
    
    if (filteredCustomers.length === 0) {
        container.innerHTML = statsHtml + `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3 style="color: var(--white); margin-bottom: 0.5rem;">${searchTerm ? 'No Customers Found' : 'No Customers Yet'}</h3>
                <p style="color: var(--gray);">${searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = statsHtml + filteredCustomers.map((customer) => {
        const typeColors = {
            residential: '#10b981',
            commercial: '#3b82f6',
            municipal: '#8b5cf6',
            contractor: '#f59e0b'
        };
        
        const typeColor = typeColors[customer.type] || '#ff6b1a';
        
        return `
            <div class="customer-card" data-customer-id="${customer.id}" onclick="viewCustomerDetails(${customer.id})" style="cursor: pointer;">
                <div class="customer-header">
                    <div style="flex: 1;">
                        <h3 class="customer-name">${customer.name}</h3>
                        <span class="customer-type" style="background: ${typeColor}33; color: ${typeColor};">
                            ${customer.type}
                        </span>
                    </div>
                    <div class="customer-actions" onclick="event.stopPropagation()">
                        <button onclick="editCustomer(${customer.id})" class="btn-icon" title="Edit">
                            ✏️
                        </button>
                        <button onclick="createInvoiceForCustomer(${customer.id})" class="btn-icon" title="Create Invoice" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #10b981;">
                            📄
                        </button>
                        <button onclick="deleteCustomer(${customer.id})" class="btn-icon delete" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="customer-info">
                    ${customer.contact_person ? `<div class="customer-info-row"><span class="customer-info-label">Contact:</span> ${customer.contact_person}</div>` : ''}
                    <div class="customer-info-row"><span class="customer-info-label">Phone:</span> <a href="tel:${customer.phone}" style="color: var(--primary-color);">${customer.phone}</a></div>
                    ${customer.email ? `<div class="customer-info-row"><span class="customer-info-label">Email:</span> <a href="mailto:${customer.email}" style="color: var(--primary-color);">${customer.email}</a></div>` : ''}
                    ${customer.address || customer.city || customer.state || customer.zip ? `
                        <div class="customer-info-row">
                            <span class="customer-info-label">Address:</span> 
                            ${[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}
                        </div>
                    ` : ''}
                    ${customer.preferred_contact ? `<div class="customer-info-row"><span class="customer-info-label">Prefer:</span> ${customer.preferred_contact}</div>` : ''}
                </div>
                
                <div class="customer-stats">
                    <div class="stat-box">
                        <div class="stat-value">-</div>
                        <div class="stat-label">Jobs</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">-</div>
                        <div class="stat-label">Last Job</div>
                    </div>
                </div>
                
                ${customer.notes ? `<div class="customer-notes">${customer.notes}</div>` : ''}
                
                ${customer.custom_line_items && customer.custom_line_items.length > 0 ? `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255, 107, 26, 0.1); border: 1px solid rgba(255, 107, 26, 0.3); border-radius: 10px; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.2rem;">💰</span>
                        <span style="color: var(--primary-color); font-weight: 600; font-size: 0.9rem;">${customer.custom_line_items.length} Custom Line Item${customer.custom_line_items.length > 1 ? 's' : ''}</span>
                    </div>
                ` : ''}
                
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 107, 26, 0.15); color: var(--gray); font-size: 0.85rem;">
 **
 * Open modal to add a new customer
 * Resets form and prepares for new entry
 * @returns {void}
 */Date(customer.created_at || Date.now()).toLocaleDateString()}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Open modal to add a new customer
 * Resets form and prepares for new entry
 * @returns {void}
 */
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

/**
 * Open modal to edit an existing customer
 * Populates form with customer data and custom line items
 * @param {number} customerId - Database ID of customer to edit
 * @returns {Promise<void>}
 * @throws {Error} If customer not found
 * @example
 * await editCustomer(42);
 */
async function editCustomer(customerId) {
    try {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) {
            showNotification('Customer not found', 'error');
            return;
        }
        
        currentEditingIndex = customerId;
        
        document.getElementById('modalTitle').textContent = 'Edit Customer';
        document.getElementById('customerType').value = customer.type;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('contactPerson').value = customer.contact_person || '';
        document.getElementById('customerPhone').value = customer.phone;
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerCity').value = customer.city || '';
        document.getElementById('customerState').value = customer.state || 'IA';
        document.getElementById('customerZip').value = customer.zip || '';
        document.getElementById('preferredContact').value = customer.preferred_contact || 'phone';
        document.getElementById('customerNotes').value = customer.notes || '';
        
        // Populate custom line items table
        const tableBody = document.getElementById('customLineItemsTable');
        tableBody.innerHTML = '';
        
        if (customer.custom_line_items && customer.custom_line_items.length > 0) {
            customer.custom_line_items.forEach(item => {
                addCustomLineItemRow(item.description, item.rate);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center; color: var(--gray);">No custom line items added yet</td></tr>';
        }
        
        document.getElementById('customerModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading customer for edit:', error);
        showNotification('Error loading customer', 'error');
    }
}

/**
 * Close customer modal and reset state
 * @returns {void}
 */
function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
    currentEditingIndex = null;
}

/**
 * Delete customer from database with optimistic UI
 * Shows confirmation dialog before deletion
 * @param {number} customerId - Database ID of customer to delete
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails
 */
async function deleteCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    if (confirm(`Are you sure you want to delete ${customer.name}?\n\nThis will permanently remove this customer from your database.`)) {
        const element = document.querySelector(`[data-customer-id="${customerId}"]`);
        
        if (element && window.optimisticUI) {
            // Use optimistic UI for instant feedback
            await window.optimisticUI.deleteItem({
                element,
                apiCall: async () => {
                    const response = await fetch(`/api/customers?id=${customerId}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) throw new Error('Failed to delete customer');
                    return response.json();
                },
                animation: 'slide'
            });
            showNotification('Customer deleted successfully', 'success');
        } else {
            // Fallback to traditional approach
            try {
                const response = await fetch(`/api/customers?id=${customerId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error('Failed to delete customer');
                
                showNotification('Customer deleted successfully', 'success');
                await loadCustomers();
            } catch (error) {
                console.error('Error deleting customer:', error);
                showNotification('Error deleting customer', 'error');
            }
        }
    }
}

/**
 * Redirect to create invoice page with customer pre-filled
 * Stores customer data in sessionStorage for invoice form
 * @param {number} customerId - Database ID of customer
 * @returns {void}
 */
function createInvoiceForCustomer(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    // Store customer data in sessionStorage to pre-fill invoice
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: customer.name,
        contactPerson: customer.contact_person,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        customLineItems: customer.custom_line_items || []
    }));
    
    // Redirect to invoice creation page
    window.location.href = 'create-invoice.html';
}

// Handle form submission
document.getElementById('customerForm').addEventListener('submit', async function(e) {
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
        contact_person: document.getElementById('contactPerson').value.trim(),
        phone: document.getElementById('customerPhone').value.trim(),
        email: document.getElementById('customerEmail').value.trim(),
        address: document.getElementById('customerAddress').value.trim(),
        city: document.getElementById('customerCity').value.trim(),
        state: document.getElementById('customerState').value.trim(),
        zip: document.getElementById('customerZip').value.trim(),
        preferred_contact: document.getElementById('preferredContact').value,
        notes: document.getElementById('customerNotes').value.trim(),
        custom_line_items: customLineItems
    };
    
    try {
        let response;
        
        if (currentEditingIndex !== null) {
            // Update existing customer
            response = await fetch(`/api/customers?id=${currentEditingIndex}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            
            if (!response.ok) throw new Error('Failed to update customer');
            showNotification('Customer updated successfully', 'success');
        } else {
            // Add new customer
            response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            
            if (!response.ok) throw new Error('Failed to add customer');
            showNotification('Customer added successfully', 'success');
        }
        
        await loadCustomers();
        closeCustomerModal();
    } catch (error) {
        console.error('Error saving customer:', error);
        showNotification('Error saving customer', 'error');
    }
});

// Search functionality with debouncing
const debouncedSearch = debounce((searchTerm) => {
    displayCustomers(searchTerm);
}, 300);

document.getElementById('searchInput').addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
});

// Note: showNotification function is now in utils.js

// Pagination controls
function updatePaginationControls() {
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
    
    if (totalPages <= 1) {
        paginationDiv.style.display = 'none';
        return;
    }
    
    paginationDiv.style.display = 'flex';
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalCustomers);
    
    paginationDiv.innerHTML = `
        <div style="color: var(--gray); font-size: 0.9rem;">
            Showing ${startItem}-${endItem} of ${totalCustomers} customers
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
                onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}
                style="padding: 0.5rem 1rem; background: rgba(255, 107, 26, 0.1); border: 1px solid rgba(255, 107, 26, 0.3); color: var(--primary-color); border-radius: 8px; cursor: pointer; font-weight: 600;"
            >
                ← Previous
            </button>
            <span style="color: var(--white); font-weight: 600;">
                Page ${currentPage} of ${totalPages}
            </span>
            <button 
                onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}
                style="padding: 0.5rem 1rem; background: rgba(255, 107, 26, 0.1); border: 1px solid rgba(255, 107, 26, 0.3); color: var(--primary-color); border-radius: 8px; cursor: pointer; font-weight: 600;"
            >
                Next →
            </button>
        </div>
    `;
}

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    loadCustomers(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
async function initializePage() {
    await loadCustomers();
    
    // Check if coming from customer details page with edit parameter
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId !== null) {
        const customerId = parseInt(editId);
        // Wait a moment for customers to be loaded
        setTimeout(() => {
            editCustomer(customerId);
        }, 100);
    }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/';
}

let allInvoices = [];

// Load invoices on page load
async function loadInvoices() {
    try {
        const response = await fetch('/api/invoices?action=all');
        if (!response.ok) throw new Error('Failed to load invoices');
        
        const data = await response.json();
        allInvoices = data.invoices || [];
        displayInvoices(allInvoices);
        loadStats();
    } catch (error) {
        console.error('Error loading invoices:', error);
        document.getElementById('invoicesTableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--red);">
                    Failed to load invoices. Please try again.
                </td>
            </tr>
        `;
    }
}

// Display invoices in table
function displayInvoices(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    
    if (invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray);">
                    No invoices found. Create your first invoice!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = invoices.map(invoice => {
        const statusClass = getStatusClass(invoice.status);
        const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();
        const dueDate = new Date(invoice.due_date).toLocaleDateString();
        
        return `
            <tr>
                <td>${invoice.invoice_number}</td>
                <td>${invoice.customer_name}</td>
                <td>${invoiceDate}</td>
                <td>${dueDate}</td>
                <td>$${parseFloat(invoice.total).toFixed(2)}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${invoice.status}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="viewInvoice(${invoice.id})" class="btn-action" title="View">
                            👁️
                        </button>
                        <button onclick="editInvoice(${invoice.id})" class="btn-action" title="Edit">
                            ✏️
                        </button>
                        <button onclick="deleteInvoice(${invoice.id})" class="btn-action btn-danger" title="Delete">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status CSS class
function getStatusClass(status) {
    switch(status.toLowerCase()) {
        case 'paid': return 'status-paid';
        case 'sent': return 'status-sent';
        case 'overdue': return 'status-overdue';
        case 'draft': return 'status-draft';
        default: return '';
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/invoices?action=stats');
        if (!response.ok) throw new Error('Failed to load stats');
        
        const stats = await response.json();
        
        // Update stats that exist in the HTML
        const totalInvoicesEl = document.getElementById('totalInvoices');
        const totalRevenueEl = document.getElementById('totalRevenue');
        const pendingAmountEl = document.getElementById('pendingAmount');
        const overdueCountEl = document.getElementById('overdueCount');
        
        if (totalInvoicesEl) totalInvoicesEl.textContent = stats.total || 0;
        if (totalRevenueEl) totalRevenueEl.textContent = `$${(stats.total_amount || 0).toFixed(2)}`;
        if (pendingAmountEl) pendingAmountEl.textContent = `$${(stats.outstanding_amount || 0).toFixed(2)}`;
        if (overdueCountEl) overdueCountEl.textContent = stats.overdue || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Filter invoices
function filterInvoices(status) {
    if (status === 'all') {
        displayInvoices(allInvoices);
    } else {
        const filtered = allInvoices.filter(inv => inv.status.toLowerCase() === status.toLowerCase());
        displayInvoices(filtered);
    }
}

// Search invoices
function searchInvoices(query) {
    query = query.toLowerCase();
    const filtered = allInvoices.filter(inv => 
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.customer_name.toLowerCase().includes(query)
    );
    displayInvoices(filtered);
}

// View invoice
function viewInvoice(id) {
    // TODO: Implement invoice viewer
    alert('Invoice viewer coming soon!');
}

// Edit invoice
function editInvoice(id) {
    // Redirect to edit page with invoice ID
    window.location.href = `/admin/create-invoice.html?id=${id}`;
}

// Delete invoice
async function deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
        const response = await fetch(`/api/invoices?action=delete&id=${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete invoice');
        
        alert('Invoice deleted successfully');
        loadInvoices();
    } catch (error) {
        console.error('Error deleting invoice:', error);
        alert('Failed to delete invoice');
    }
}

// Initialize
loadInvoices();

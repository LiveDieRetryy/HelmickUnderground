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
                    <select onchange="updateInvoiceStatus(${invoice.id}, this.value)" class="status-select" style="background: ${getStatusColor(invoice.status)}; color: white; padding: 0.5rem; border-radius: 6px; border: none; font-weight: 600; cursor: pointer;">
                        <option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Sent</option>
                        <option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Paid</option>
                        <option value="overdue" ${invoice.status === 'overdue' ? 'selected' : ''}>Overdue</option>
                        <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
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

// Get status color
function getStatusColor(status) {
    switch(status?.toLowerCase()) {
        case 'draft': return '#6b7280';
        case 'sent': return '#3b82f6';
        case 'paid': return '#22c55e';
        case 'overdue': return '#ef4444';
        case 'cancelled': return '#dc2626';
        default: return '#6b7280';
    }
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

// Update invoice status
async function updateInvoiceStatus(id, status) {
    try {
        const response = await fetch(`/api/invoices?action=updateStatus&id=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Failed to update status');
        
        // Reload invoices to update stats
        await loadInvoices();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update invoice status');
        loadInvoices(); // Reload to reset the dropdown
    }
}

// View invoice
async function viewInvoice(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        
        // Parse items - check if it's already an object or a string
        let items;
        try {
            items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        } catch (e) {
            console.error('Error parsing items:', e);
            items = [];
        }
        
        if (!Array.isArray(items)) {
            console.error('Items is not an array:', items);
            items = [];
        }
        
        const itemsHTML = items.map(item => `
            <tr>
                <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">${item.description || ''}</td>
                <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${item.quantity || 0}</td>
                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee;">$${parseFloat(item.rate || 0).toFixed(2)}</td>
                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee; font-weight: 600;">$${parseFloat(item.amount || 0).toFixed(2)}</td>
            </tr>
        `).join('');
        
        const modalHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;" onclick="this.remove()">
                <div style="background: white; border-radius: 20px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative;" onclick="event.stopPropagation()">
                    <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="position: absolute; top: 1rem; right: 1rem; background: rgba(220, 20, 60, 0.9); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.5rem; z-index: 1;">×</button>
                    
                    <div style="padding: 3rem;">
                        <div style="text-align: center; margin-bottom: 2rem;">
                            <h1 style="color: #ff6b1a; margin: 0;">Invoice Preview</h1>
                            <p style="color: #666; margin: 0.5rem 0;">${invoice.invoice_number}</p>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                            <div>
                                <h3 style="color: #333; margin: 0 0 0.5rem 0;">Customer Information</h3>
                                <p style="margin: 0.25rem 0; color: #666;"><strong>Name:</strong> ${invoice.customer_name}</p>
                                ${invoice.customer_email ? `<p style="margin: 0.25rem 0; color: #666;"><strong>Email:</strong> ${invoice.customer_email}</p>` : ''}
                                ${invoice.customer_phone ? `<p style="margin: 0.25rem 0; color: #666;"><strong>Phone:</strong> ${invoice.customer_phone}</p>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <p style="margin: 0.25rem 0; color: #666;"><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                                <p style="margin: 0.25rem 0; color: #666;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
                                <p style="margin: 0.25rem 0; color: #666;"><strong>Status:</strong> <span style="color: ${getStatusColor(invoice.status)}; font-weight: 600;">${invoice.status.toUpperCase()}</span></p>
                            </div>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
                            <thead>
                                <tr style="background: #f5f5f5;">
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #ff6b1a;">Description</th>
                                    <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #ff6b1a;">Quantity</th>
                                    <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #ff6b1a;">Rate</th>
                                    <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #ff6b1a;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                                <tr style="font-weight: 600; background: #fff3e6;">
                                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; border-top: 2px solid #ff6b1a;">Subtotal:</td>
                                    <td style="padding: 1rem 0.75rem; text-align: right; border-top: 2px solid #ff6b1a;">$${parseFloat(invoice.subtotal).toFixed(2)}</td>
                                </tr>
                                ${parseFloat(invoice.tax) > 0 ? `
                                <tr style="font-weight: 600;">
                                    <td colspan="3" style="padding: 0.5rem 0.75rem; text-align: right;">Tax (${parseFloat(invoice.tax_rate).toFixed(2)}%):</td>
                                    <td style="padding: 0.5rem 0.75rem; text-align: right;">$${parseFloat(invoice.tax).toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                <tr style="font-weight: 700; font-size: 1.2rem; background: #ff6b1a; color: white;">
                                    <td colspan="3" style="padding: 1rem 0.75rem; text-align: right;">Total:</td>
                                    <td style="padding: 1rem 0.75rem; text-align: right;">$${parseFloat(invoice.total).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Error viewing invoice:', error);
        alert('Failed to load invoice preview');
    }
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

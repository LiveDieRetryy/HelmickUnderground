// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
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
                        <button onclick="openSendInvoiceModal(${invoice.id})" class="btn-action" title="Send Invoice" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
                            📧
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
        if (totalRevenueEl) totalRevenueEl.textContent = `$${(stats.paidAmount || 0).toFixed(2)}`;
        if (pendingAmountEl) pendingAmountEl.textContent = `$${(stats.pendingAmount || 0).toFixed(2)}`;
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
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        // Build the same email HTML that gets sent
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
                                <p style="margin: 0; line-height: 1.6; color: #ffffff; font-weight: 600;">${invoice.customer_name}</p>
                                ${invoice.customer_address ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_address}</p>` : ''}
                                <p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_email}</p>
                                ${invoice.customer_phone ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_phone}</p>` : ''}
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Invoice Details -->
                <div style="padding: 2rem; background: #1a1a1a;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                        <tr>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Number:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 1.1rem;">${invoice.invoice_number}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Due Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ff6b1a; font-weight: 700;">${new Date(invoice.due_date).toLocaleDateString()}</p>
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
                                <td style="padding: 1rem; text-align: right; font-weight: 600; color: #ffffff;">$${parseFloat(invoice.subtotal || 0).toFixed(2)}</td>
                            </tr>
                            ${invoice.tax_rate > 0 ? `
                            <tr>
                                <td colspan="3" style="padding: 0.5rem 1rem; text-align: right; color: #b0b0b0;">Tax (${invoice.tax_rate}%):</td>
                                <td style="padding: 0.5rem 1rem; text-align: right; color: #ffffff;">$${parseFloat(invoice.tax || 0).toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white;">
                                <td colspan="3" style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">Total Due:</td>
                                <td style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">$${parseFloat(invoice.total).toFixed(2)}</td>
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

        const modalHTML = `
            <div id="invoicePreviewModal" onclick="closeSendInvoiceModal()" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 2rem;">
                <div onclick="event.stopPropagation()" style="background: var(--card-dark); border-radius: 20px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid rgba(255, 107, 26, 0.3);">
                    <div style="padding: 2rem; border-bottom: 2px solid rgba(255, 107, 26, 0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2 style="color: var(--primary-color); margin: 0;">👁️ Invoice Preview</h2>
                            <button onclick="document.getElementById('invoicePreviewModal').remove()" style="background: rgba(220, 20, 60, 0.2); border: 1px solid rgba(220, 20, 60, 0.5); color: var(--red); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.5rem;">×</button>
                        </div>
                    </div>
                    
                    <div style="padding: 2rem;">
                        <div style="width: 100%; background: white; border: 2px solid rgba(255, 107, 26, 0.3); border-radius: 12px; max-height: 600px; overflow-y: auto;">
                            ${emailHTML}
                        </div>
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

// Open send invoice modal with email preview
async function openSendInvoiceModal(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        const emailSubject = `Invoice ${invoice.invoice_number} from Helmick Underground`;
        
        // Create styled HTML email preview
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
                                <p style="margin: 0; line-height: 1.6; color: #ffffff; font-weight: 600;">${invoice.customer_name}</p>
                                ${invoice.customer_address ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_address}</p>` : ''}
                                <p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_email}</p>
                                ${invoice.customer_phone ? `<p style="margin: 0.25rem 0; line-height: 1.6; color: #b0b0b0;">${invoice.customer_phone}</p>` : ''}
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Invoice Details -->
                <div style="padding: 2rem; background: #1a1a1a;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                        <tr>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Number:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 1.1rem;">${invoice.invoice_number}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Invoice Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ffffff; font-weight: 700;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                            </td>
                            <td style="width: 33.33%; padding: 1.25rem; vertical-align: top;">
                                <p style="margin: 0; color: #888; font-size: 0.85rem; font-weight: 600;">Due Date:</p>
                                <p style="margin: 0.25rem 0 0 0; color: #ff6b1a; font-weight: 700;">${new Date(invoice.due_date).toLocaleDateString()}</p>
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
                                <td style="padding: 1rem; text-align: right; font-weight: 600; color: #ffffff;">$${parseFloat(invoice.subtotal || 0).toFixed(2)}</td>
                            </tr>
                            ${invoice.tax_rate > 0 ? `
                            <tr>
                                <td colspan="3" style="padding: 0.5rem 1rem; text-align: right; color: #b0b0b0;">Tax (${invoice.tax_rate}%):</td>
                                <td style="padding: 0.5rem 1rem; text-align: right; color: #ffffff;">$${parseFloat(invoice.tax || 0).toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white;">
                                <td colspan="3" style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">Total Due:</td>
                                <td style="padding: 1.25rem 1rem; text-align: right; font-weight: 700; font-size: 1.3rem;">$${parseFloat(invoice.total).toFixed(2)}</td>
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

        const modalHTML = `
            <div id="sendInvoiceModal" onclick="closeSendInvoiceModal()" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 2rem;">
                <div onclick="event.stopPropagation()" style="background: var(--card-dark); border-radius: 20px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; border: 2px solid rgba(255, 107, 26, 0.3);">
                    <div style="padding: 2rem; border-bottom: 2px solid rgba(255, 107, 26, 0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2 style="color: var(--primary-color); margin: 0;">📧 Send Invoice</h2>
                            <button onclick="closeSendInvoiceModal()" style="background: rgba(220, 20, 60, 0.2); border: 1px solid rgba(220, 20, 60, 0.5); color: var(--red); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.5rem;">×</button>
                        </div>
                    </div>
                    
                    <div style="padding: 2rem;">
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; color: var(--gray); font-weight: 600; margin-bottom: 0.5rem;">To:</label>
                            <input type="email" id="invoiceEmailTo" value="${invoice.customer_email || ''}" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); color: var(--white); padding: 0.75rem; border-radius: 8px; font-size: 1rem;">
                        </div>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; color: var(--gray); font-weight: 600; margin-bottom: 0.5rem;">Subject:</label>
                            <input type="text" id="invoiceEmailSubject" value="${emailSubject}" style="width: 100%; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 107, 26, 0.3); color: var(--white); padding: 0.75rem; border-radius: 8px; font-size: 1rem;">
                        </div>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; color: var(--gray); font-weight: 600; margin-bottom: 0.5rem;">Email Preview:</label>
                            <div id="invoiceEmailPreview" style="width: 100%; background: white; border: 2px solid rgba(255, 107, 26, 0.3); border-radius: 12px; max-height: 500px; overflow-y: auto;">
                                ${emailHTML}
                            </div>
                        </div>
                    </div>
                    
                    <div style="padding: 1.5rem 2rem; background: rgba(0, 0, 0, 0.2); border-top: 2px solid rgba(255, 107, 26, 0.2); display: flex; gap: 1rem; border-radius: 0 0 20px 20px;">
                        <button onclick="sendInvoiceEmail(${id})" style="flex: 1; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1rem;">
                            📧 Send Email
                        </button>
                        <button onclick="downloadInvoicePDF(${id})" style="flex: 1; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1rem;">
                            📥 Download PDF
                        </button>
                        <button onclick="printInvoice(${id})" style="flex: 1; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1rem;">
                            🖨️ Print
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error opening send invoice modal:', error);
        alert('Failed to load invoice');
    }
}

// Close send invoice modal
function closeSendInvoiceModal() {
    const modal = document.getElementById('sendInvoiceModal');
    if (modal) modal.remove();
}

// Send invoice email
async function sendInvoiceEmail(id) {
    const to = document.getElementById('invoiceEmailTo').value;
    const subject = document.getElementById('invoiceEmailSubject').value;
    const htmlContent = document.getElementById('invoiceEmailPreview').innerHTML;
    
    if (!to) {
        showNotification('Please enter recipient email address', 'error');
        return;
    }
    
    try {
        // Send email via Resend API
        const response = await fetch('/api/send-invoice-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to send email');
        }
        
        // Update invoice status to 'sent'
        await updateInvoiceStatus(id, 'sent');
        
        showNotification('✅ Invoice email sent successfully!', 'success');
        closeSendInvoiceModal();
        loadInvoices();
        
    } catch (error) {
        console.error('Error sending invoice:', error);
        showNotification('❌ Failed to send invoice email: ' + error.message, 'error');
    }
}

// Show notification message
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

// Download invoice as PDF
async function downloadInvoicePDF(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        // Create a temporary container for the invoice HTML
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '800px';
        
        // Build compact invoice HTML
        container.innerHTML = `
    <div style="padding: 1rem; background: #1a1a1a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e5e7eb;">
        <!-- Header with logo in corner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="width: 100px; height: auto;">
            <div style="text-align: right;">
                <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 0.5rem 1.5rem; display: inline-block;">
                    <h2 style="color: white; margin: 0; font-size: 1.3rem; font-weight: 700;">INVOICE</h2>
                </div>
            </div>
        </div>
        
        <!-- From/Bill To Section -->
        <div style="background: #2a2a2a; padding: 0.75rem; margin-bottom: 1rem; border-bottom: 2px solid #ff6b1a;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top; padding-right: 1rem;">
                        <h3 style="color: #ff6b1a; margin: 0 0 0.5rem 0; font-size: 0.9rem;">From:</h3>
                        <p style="margin: 0; line-height: 1.4; color: #ffffff; font-weight: 600; font-size: 0.9rem;">Helmick Underground</p>
                        <p style="margin: 0.2rem 0; line-height: 1.4; color: #b0b0b0; font-size: 0.85rem;">498 Elbow Creek Rd, Mount Vernon, IA 52314</p>
                        <p style="margin: 0.2rem 0; line-height: 1.4; color: #b0b0b0; font-size: 0.85rem;">HelmickUnderground@gmail.com</p>
                    </td>
                    <td style="width: 50%; vertical-align: top; padding-left: 1rem;">
                        <h3 style="color: #ff6b1a; margin: 0 0 0.5rem 0; font-size: 0.9rem;">Bill To:</h3>
                        <p style="margin: 0; line-height: 1.4; color: #ffffff; font-weight: 600; font-size: 0.9rem;">${invoice.customer_name}</p>
                        ${invoice.customer_address ? `<p style="margin: 0.2rem 0; line-height: 1.4; color: #b0b0b0; font-size: 0.85rem;">${invoice.customer_address}</p>` : ''}
                        <p style="margin: 0.2rem 0; line-height: 1.4; color: #b0b0b0; font-size: 0.85rem;">${invoice.customer_email}</p>
                        ${invoice.customer_phone ? `<p style="margin: 0.2rem 0; line-height: 1.4; color: #b0b0b0; font-size: 0.85rem;">${invoice.customer_phone}</p>` : ''}
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Invoice Details -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem; background: #2a2a2a; border-left: 3px solid #ff6b1a;">
            <tr>
                <td style="width: 33.33%; padding: 0.75rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.75rem; font-weight: 600;">Invoice Number:</p>
                    <p style="margin: 0.2rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 1rem;">${invoice.invoice_number}</p>
                </td>
                <td style="width: 33.33%; padding: 0.75rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.75rem; font-weight: 600;">Invoice Date:</p>
                    <p style="margin: 0.2rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 1rem;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                </td>
                <td style="width: 33.33%; padding: 0.75rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.75rem; font-weight: 600;">Due Date:</p>
                    <p style="margin: 0.2rem 0 0 0; color: #ff6b1a; font-weight: 700; font-size: 1rem;">${new Date(invoice.due_date).toLocaleDateString()}</p>
                </td>
            </tr>
        </table>
        
        <!-- Line Items -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem; background: #2a2a2a;">
            <thead>
                <tr style="background: #333; color: white;">
                    <th style="padding: 0.6rem; text-align: left; font-weight: 700; font-size: 0.9rem;">Description</th>
                    <th style="padding: 0.6rem; text-align: center; font-weight: 700; font-size: 0.9rem;">Qty</th>
                    <th style="padding: 0.6rem; text-align: right; font-weight: 700; font-size: 0.9rem;">Rate</th>
                    <th style="padding: 0.6rem; text-align: right; font-weight: 700; font-size: 0.9rem;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.6rem; color: #e5e7eb; font-size: 0.9rem;">${item.description}</td>
                        <td style="padding: 0.6rem; text-align: center; color: #b0b0b0; font-size: 0.9rem;">${item.quantity}</td>
                        <td style="padding: 0.6rem; text-align: right; color: #b0b0b0; font-size: 0.9rem;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.6rem; text-align: right; color: #ffffff; font-weight: 600; font-size: 0.9rem;">$${(item.quantity * item.rate).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #ff6b1a;">
                    <td colspan="3" style="padding: 0.6rem; text-align: right; font-weight: 600; color: #b0b0b0; font-size: 0.9rem;">Subtotal:</td>
                    <td style="padding: 0.6rem; text-align: right; font-weight: 600; color: #ffffff; font-size: 0.9rem;">$${parseFloat(invoice.subtotal || 0).toFixed(2)}</td>
                </tr>
                ${invoice.tax_rate > 0 ? `
                <tr>
                    <td colspan="3" style="padding: 0.4rem 0.6rem; text-align: right; color: #b0b0b0; font-size: 0.9rem;">Tax (${invoice.tax_rate}%):</td>
                    <td style="padding: 0.4rem 0.6rem; text-align: right; color: #ffffff; font-size: 0.9rem;">$${parseFloat(invoice.tax || 0).toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white;">
                    <td colspan="3" style="padding: 0.75rem 0.6rem; text-align: right; font-weight: 700; font-size: 1.2rem;">Total Due:</td>
                    <td style="padding: 0.75rem 0.6rem; text-align: right; font-weight: 700; font-size: 1.2rem;">$${parseFloat(invoice.total).toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
    </div>`;
        
        document.body.appendChild(container);
        
        // Generate PDF using html2pdf
        const opt = {
            margin: 0.5,
            filename: `Invoice-${invoice.invoice_number}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#1a1a1a' },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        await html2pdf().set(opt).from(container).save();
        
        // Remove temporary container
        document.body.removeChild(container);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showNotification('Failed to generate PDF', 'error');
    }
}

// Print invoice
async function printInvoice(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        // Build compact print HTML (single-page optimized)
        const printHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { 
            margin: 0.5in; 
            size: auto;
        }
        @media print {
            body { margin: 0; padding: 0; font-size: 10pt; }
            .no-print { display: none; }
            @page { margin: 0.5in; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #e5e7eb; }
    </style>
</head>
<body>
    <div style="padding: 0.5rem; background: #1a1a1a;">
        <!-- Header with logo in corner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="width: 100px; height: auto;">
            <div style="text-align: right;">
                <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 0.5rem 1.5rem; display: inline-block;">
                    <h2 style="color: white; margin: 0; font-size: 1.3rem; font-weight: 700;">INVOICE</h2>
                </div>
            </div>
        </div>
        
        <!-- From/Bill To Section -->
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
                        <h3 style="color: #ff6b1a; margin: 0 0 0.3rem 0; font-size: 0.85rem;">Bill To:</h3>
                        <p style="margin: 0; line-height: 1.3; color: #ffffff; font-weight: 600; font-size: 0.85rem;">${invoice.customer_name}</p>
                        ${invoice.customer_address ? `<p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">${invoice.customer_address}</p>` : ''}
                        <p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">${invoice.customer_email}</p>
                        ${invoice.customer_phone ? `<p style="margin: 0.1rem 0; line-height: 1.3; color: #b0b0b0; font-size: 0.8rem;">${invoice.customer_phone}</p>` : ''}
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- Invoice Details -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; background: #2a2a2a; border-left: 3px solid #ff6b1a;">
            <tr>
                <td style="width: 33.33%; padding: 0.5rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.7rem; font-weight: 600;">Invoice Number:</p>
                    <p style="margin: 0.1rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 0.9rem;">${invoice.invoice_number}</p>
                </td>
                <td style="width: 33.33%; padding: 0.5rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.7rem; font-weight: 600;">Invoice Date:</p>
                    <p style="margin: 0.1rem 0 0 0; color: #ffffff; font-weight: 700; font-size: 0.9rem;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                </td>
                <td style="width: 33.33%; padding: 0.5rem; vertical-align: top;">
                    <p style="margin: 0; color: #888; font-size: 0.7rem; font-weight: 600;">Due Date:</p>
                    <p style="margin: 0.1rem 0 0 0; color: #ff6b1a; font-weight: 700; font-size: 0.9rem;">${new Date(invoice.due_date).toLocaleDateString()}</p>
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
                ${items.map(item => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.4rem; color: #e5e7eb; font-size: 0.85rem;">${item.description}</td>
                        <td style="padding: 0.4rem; text-align: center; color: #b0b0b0; font-size: 0.85rem;">${item.quantity}</td>
                        <td style="padding: 0.4rem; text-align: right; color: #b0b0b0; font-size: 0.85rem;">$${item.rate.toFixed(2)}</td>
                        <td style="padding: 0.4rem; text-align: right; color: #ffffff; font-weight: 600; font-size: 0.85rem;">$${(item.quantity * item.rate).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid #ff6b1a;">
                    <td colspan="3" style="padding: 0.5rem; text-align: right; font-weight: 600; color: #b0b0b0; font-size: 0.85rem;">Subtotal:</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 600; color: #ffffff; font-size: 0.85rem;">$${parseFloat(invoice.subtotal || 0).toFixed(2)}</td>
                </tr>
                ${invoice.tax_rate > 0 ? `
                <tr>
                    <td colspan="3" style="padding: 0.3rem 0.5rem; text-align: right; color: #b0b0b0; font-size: 0.85rem;">Tax (${invoice.tax_rate}%):</td>
                    <td style="padding: 0.3rem 0.5rem; text-align: right; color: #ffffff; font-size: 0.85rem;">$${parseFloat(invoice.tax || 0).toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); color: white;">
                    <td colspan="3" style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 700; font-size: 1.1rem;">Total Due:</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 700; font-size: 1.1rem;">$${parseFloat(invoice.total).toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
    </div>
    <script>
        window.onload = function() {
            window.print();
            window.onafterprint = function() {
                window.close();
            };
        };
    </script>
</body>
</html>`;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHTML);
        printWindow.document.close();
        
    } catch (error) {
        console.error('Error printing invoice:', error);
        showNotification('Failed to print invoice', 'error');
    }
}

// Initialize
loadInvoices();

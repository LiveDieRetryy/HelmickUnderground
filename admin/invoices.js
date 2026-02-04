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
        
        // Build invoice number display with job number if available
        const invoiceDisplay = invoice.job_number 
            ? `${invoice.invoice_number}<br><span style="color: var(--gray); font-size: 0.85rem;">Job: ${invoice.job_number}</span>`
            : invoice.invoice_number;
        
        return `
            <tr>
                <td>${invoiceDisplay}</td>
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
        
        // If status changed to paid, update linked submission to complete
        if (status === 'paid') {
            try {
                // Find submission with this invoice_id
                const subResponse = await fetch('/api/contact-submissions?action=all');
                if (subResponse.ok) {
                    const submissions = await subResponse.json();
                    const linkedSub = submissions.find(s => s.invoice_id == id);
                    
                    if (linkedSub) {
                        // Update submission status to completed
                        await fetch('/api/contact-submissions', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: linkedSub.id, status: 'completed' })
                        });
                    }
                }
            } catch (syncError) {
                console.error('Failed to sync submission status:', syncError);
                // Don't fail the whole operation if sync fails
            }
        }
        
        // Reload invoices to update stats
        await loadInvoices();
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Failed to update invoice status', 'error');
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
        showNotification('Failed to load invoice preview', 'error');
    }
}

// Edit invoice
function editInvoice(id) {
    // Redirect to edit page with invoice ID
    window.location.href = `/admin/create-invoice.html?id=${id}`;
}

// Delete invoice
// Delete invoice with confirmation modal
let deleteInvoiceId = null;

function deleteInvoice(id) {
    deleteInvoiceId = id;
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'flex';
    
    // Set up confirm button
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = confirmDeleteInvoice;
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.style.display = 'none';
    deleteInvoiceId = null;
}

async function confirmDeleteInvoice() {
    if (!deleteInvoiceId) return;
    
    // Store ID before closing modal (which sets deleteInvoiceId to null)
    const idToDelete = deleteInvoiceId;
    closeDeleteModal();
    
    try {
        const response = await fetch(`/api/invoices?action=delete&id=${idToDelete}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Delete failed:', response.status, errorData);
            throw new Error(errorData.message || 'Failed to delete invoice');
        }
        
        showNotification('Invoice deleted successfully', 'success');
        loadInvoices();
    } catch (error) {
        console.error('Error deleting invoice:', error);
        showNotification('Failed to delete invoice', 'error');
    }
}

// Open send invoice modal with email preview
async function openSendInvoiceModal(id) {
    try {
        const response = await fetch(`/api/invoices?action=get&id=${id}`);
        if (!response.ok) throw new Error('Failed to load invoice');
        
        const invoice = await response.json();
        const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
        
        const emailSubject = invoice.job_number 
            ? `Job #${invoice.job_number} - Invoice ${invoice.invoice_number} from Helmick Underground`
            : `Invoice ${invoice.invoice_number} from Helmick Underground`;
        
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
        showNotification('Failed to load invoice', 'error');
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
        // Get invoice data for metadata
        const invoice = invoices.find(inv => inv.id === id);
        
        // Send email via consolidated email API
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'invoice',
                to: to,
                subject: subject,
                html: htmlContent,
                name: invoice?.customer_name || to,
                metadata: {
                    invoiceId: id,
                    invoiceNumber: invoice?.invoice_number
                }
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
        
        // Get jsPDF from window
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 50;
        
        // White background (printer-friendly)
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        let yPos = margin;
        
        // Logo (top left) - use relative path
        try {
            const logoBase64 = await getLogoBase64();
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', margin, yPos, 100, 50);
            }
        } catch (e) {
            console.error('Logo failed to load:', e);
            // Fallback: draw company name as text
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Helmick Underground', margin, yPos + 20);
        }
        
        // INVOICE header (top right)
        doc.setFillColor(255, 107, 26);
        doc.roundedRect(pageWidth - margin - 120, yPos, 120, 35, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth - margin - 60, yPos + 23, { align: 'center' });
        
        yPos += 60;
        
        // From/Bill To Section
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 80, 3, 3, 'F');
        
        // Orange bottom border
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos + 78, pageWidth - 2 * margin, 2, 'F');
        
        // From section
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('From:', margin + 15, yPos + 20);
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Helmick Underground', margin + 15, yPos + 35);
        
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('498 Elbow Creek Rd, Mount Vernon, IA 52314', margin + 15, yPos + 48);
        doc.text('HelmickUnderground@gmail.com', margin + 15, yPos + 61);
        
        // Bill To section
        const midPoint = pageWidth / 2 + 20;
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', midPoint, yPos + 20);
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(invoice.customer_name, midPoint, yPos + 35);
        
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let billToY = yPos + 48;
        if (invoice.customer_address) {
            doc.text(invoice.customer_address, midPoint, billToY);
            billToY += 13;
        }
        doc.text(invoice.customer_email, midPoint, billToY);
        if (invoice.customer_phone) {
            doc.text(invoice.customer_phone, midPoint, billToY + 13);
        }
        
        yPos += 95;
        
        // Invoice Details Box
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 45, 3, 3, 'F');
        
        // Orange left border
        doc.setFillColor(255, 107, 26);
        doc.rect(margin, yPos, 3, 45, 'F');
        
        const detailWidth = (pageWidth - 2 * margin) / 3;
        
        // Invoice Number
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Number:', margin + 15, yPos + 15);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(invoice.invoice_number, margin + 15, yPos + 30);
        
        // Invoice Date
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Invoice Date:', margin + detailWidth + 15, yPos + 15);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(new Date(invoice.invoice_date).toLocaleDateString(), margin + detailWidth + 15, yPos + 30);
        
        // Due Date
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('Due Date:', margin + detailWidth * 2 + 15, yPos + 15);
        doc.setTextColor(255, 107, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(new Date(invoice.due_date).toLocaleDateString(), margin + detailWidth * 2 + 15, yPos + 30);
        
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
        items.forEach((item, index) => {
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F');
            }
            
            // Draw row border
            doc.setDrawColor(230, 230, 230);
            doc.line(margin, yPos + 25, pageWidth - margin, yPos + 25);
            
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(9);
            doc.text(item.description, margin + 10, yPos + 16);
            
            doc.setTextColor(80, 80, 80);
            doc.text(item.quantity.toString(), pageWidth - margin - 220, yPos + 16, { align: 'center' });
            doc.text(`$${item.rate.toFixed(2)}`, pageWidth - margin - 140, yPos + 16, { align: 'right' });
            
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(item.quantity * item.rate).toFixed(2)}`, pageWidth - margin - 10, yPos + 16, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            
            yPos += 25;
        });
        
        // Orange separator line
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
        doc.text(`$${parseFloat(invoice.subtotal || 0).toFixed(2)}`, pageWidth - margin - 10, yPos, { align: 'right' });
        
        yPos += 20;
        
        // Tax (if applicable)
        if (invoice.tax_rate > 0) {
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tax (${invoice.tax_rate}%):`, pageWidth - margin - 150, yPos, { align: 'right' });
            doc.setTextColor(0, 0, 0);
            doc.text(`$${parseFloat(invoice.tax || 0).toFixed(2)}`, pageWidth - margin - 10, yPos, { align: 'right' });
            yPos += 20;
        }
        
        // Total Due
        doc.setFillColor(255, 107, 26);
        doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 30, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Due:', pageWidth - margin - 150, yPos + 13, { align: 'right' });
        doc.text(`$${parseFloat(invoice.total).toFixed(2)}`, pageWidth - margin - 10, yPos + 13, { align: 'right' });
        
        // Save the PDF
        doc.save(`Invoice-${invoice.invoice_number}.pdf`);
        
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
        // Try local path first, then remote
        img.src = '/logo.png';
    });
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

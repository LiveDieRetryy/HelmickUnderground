// Shared invoice preview, email, and PDF rendering.
(function() {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    }

    function normalizeInvoice(invoice) {
        const sourceItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
        const items = sourceItems.map(item => {
            const quantity = Number(item.quantity);
            const rate = Number(item.rate);
            return {
                description: item.description || item.name || '',
                quantity,
                rate,
                amount: quantity * rate
            };
        });

        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        const taxRate = Number(invoice.tax_rate ?? invoice.taxRate) || 0;
        const tax = subtotal * (taxRate / 100);
        const retainageRate = Number(invoice.retainage_rate ?? invoice.retainageRate) || 0;
        const retainageAmount = Number(invoice.retainage_amount ?? invoice.retainageAmount) || (subtotal + tax) * (retainageRate / 100);
        const amountDue = Number(invoice.amount_due ?? invoice.amountDue) || (subtotal + tax) - retainageAmount;

        return {
            invoice_number: invoice.invoice_number || invoice.invoiceNumber || '',
            invoice_date: invoice.invoice_date || invoice.invoiceDate || '',
            due_date: invoice.due_date || invoice.dueDate || '',
            customer_name: invoice.customer_name || invoice.customer?.name || '',
            customer_email: invoice.customer_email || invoice.customer?.email || '',
            customer_phone: invoice.customer_phone || invoice.customer?.phone || '',
            customer_address: invoice.customer_address || invoice.customer?.address || '',
            job_number: invoice.job_number || invoice.jobInfo?.jobNumber || '',
            job_address: invoice.job_address || invoice.jobInfo?.jobAddress || '',
            job_city: invoice.job_city || invoice.jobInfo?.jobCity || '',
            job_state: invoice.job_state || invoice.jobInfo?.jobState || '',
            notes: invoice.notes || '',
            items,
            tax_rate: taxRate,
            retainage_rate: retainageRate,
            retainage_amount: retainageAmount,
            amount_due: amountDue,
            subtotal,
            tax,
            total: subtotal + tax
        };
    }

    function fromForm() {
        const items = Array.from(document.querySelectorAll('.line-item')).map(item => ({
            description: item.querySelector('.item-description')?.value || '',
            quantity: Number(item.querySelector('.item-quantity')?.value),
            rate: Number(item.querySelector('.item-rate')?.value)
        }));

        return normalizeInvoice({
            invoiceNumber: document.getElementById('invoiceNumber')?.value,
            invoiceDate: document.getElementById('invoiceDate')?.value,
            dueDate: document.getElementById('dueDate')?.value,
            customer: {
                name: document.getElementById('customerName')?.value,
                email: document.getElementById('customerEmail')?.value,
                phone: document.getElementById('customerPhone')?.value,
                address: document.getElementById('customerAddress')?.value
            },
            jobInfo: {
                jobNumber: document.getElementById('jobNumber')?.value,
                jobAddress: document.getElementById('jobAddress')?.value,
                jobCity: document.getElementById('jobCity')?.value,
                jobState: document.getElementById('jobState')?.value
            },
            taxRate: document.getElementById('iowaWorkCheckbox')?.checked ? 7 : 0,
            notes: document.getElementById('invoiceNotes')?.value,
            items
        });
    }

    function buildHtml(invoice) {
        const data = normalizeInvoice(invoice);
        const itemRows = data.items.map(item => `
            <tr>
                <td style="padding:0.5rem;border-bottom:1px solid #eee;color:#333;font-size:0.85rem;">${escapeHtml(item.description)}</td>
                <td style="padding:0.5rem;text-align:center;border-bottom:1px solid #eee;color:#666;font-size:0.85rem;">${item.quantity}</td>
                <td style="padding:0.5rem;text-align:right;border-bottom:1px solid #eee;color:#666;font-size:0.85rem;">$${item.rate.toFixed(2)}</td>
                <td style="padding:0.5rem;text-align:right;border-bottom:1px solid #eee;color:#333;font-weight:600;font-size:0.85rem;">$${item.amount.toFixed(2)}</td>
            </tr>
        `).join('');

        const jobBlock = data.job_number || data.job_address ? `
            <div style="background:#fff3e6;padding:0.7rem;border-radius:6px;margin-bottom:1rem;border-left:3px solid #ff6b1a;">
                <h3 style="color:#ff6b1a;margin:0 0 0.35rem;font-size:0.85rem;">Project Information</h3>
                ${data.job_number ? `<p style="margin:0.2rem 0;color:#666;font-size:0.85rem;"><strong>Project Number:</strong> ${escapeHtml(data.job_number)}</p>` : ''}
                ${data.job_address ? `<p style="margin:0.2rem 0;color:#666;font-size:0.85rem;"><strong>Job Location:</strong> ${escapeHtml(data.job_address)}${data.job_city ? `, ${escapeHtml(data.job_city)}` : ''}${data.job_state ? `, ${escapeHtml(data.job_state)}` : ''}</p>` : ''}
            </div>
        ` : '';

        return `
            <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:760px;margin:0 auto;background:#fff;color:#333;padding:1.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1.25rem;margin-bottom:1rem;">
                    <img src="/logo.png" alt="Helmick Underground" style="width:140px;max-width:34%;height:auto;object-fit:contain;">
                    <div style="text-align:right;border:2px solid #ff6b1a;border-radius:6px;padding:0.5rem 0.9rem;min-width:125px;">
                        <h1 style="color:#ff6b1a;margin:0;font-size:1.45rem;line-height:1.1;">INVOICE</h1>
                        <p style="color:#666;margin:0.25rem 0 0;font-size:0.8rem;">#${escapeHtml(data.invoice_number)}</p>
                    </div>
                </div>
                ${jobBlock}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                    <div style="background:#f9f9f9;padding:0.7rem;border-radius:6px;border-left:3px solid #ff6b1a;">
                        <h3 style="color:#333;margin:0 0 0.5rem;font-size:0.9rem;">Bill To:</h3>
                        ${data.customer_name ? `<p style="margin:0.2rem 0;color:#666;font-size:0.9rem;font-weight:600;">${escapeHtml(data.customer_name)}</p>` : ''}
                        ${data.customer_address ? `<p style="margin:0.2rem 0;color:#666;font-size:0.85rem;white-space:pre-wrap;">${escapeHtml(data.customer_address)}</p>` : ''}
                        ${data.customer_email ? `<p style="margin:0.2rem 0;color:#666;font-size:0.85rem;">${escapeHtml(data.customer_email)}</p>` : ''}
                        ${data.customer_phone ? `<p style="margin:0.2rem 0;color:#666;font-size:0.85rem;">${escapeHtml(data.customer_phone)}</p>` : ''}
                    </div>
                    <div style="background:#f9f9f9;padding:0.7rem;border-radius:6px;">
                        <p style="margin:0.4rem 0;color:#666;font-size:0.9rem;"><strong>Invoice Date:</strong> ${formatDate(data.invoice_date)}</p>
                        <p style="margin:0.4rem 0;color:#666;font-size:0.9rem;"><strong>Due Date:</strong> ${formatDate(data.due_date)}</p>
                    </div>
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;font-size:0.82rem;">
                    <thead><tr style="background:#f0f0f0;">
                        <th style="padding:0.5rem;text-align:left;color:#333;border-bottom:2px solid #ff6b1a;font-size:0.85rem;">Description</th>
                        <th style="padding:0.5rem;text-align:center;color:#333;border-bottom:2px solid #ff6b1a;font-size:0.85rem;">Qty</th>
                        <th style="padding:0.5rem;text-align:right;color:#333;border-bottom:2px solid #ff6b1a;font-size:0.85rem;">Rate</th>
                        <th style="padding:0.5rem;text-align:right;color:#333;border-bottom:2px solid #ff6b1a;font-size:0.85rem;">Amount</th>
                    </tr></thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot>
                        <tr style="border-top:2px solid #ff6b1a;"><td colspan="3" style="padding:0.6rem 0.5rem;text-align:right;font-weight:600;color:#666;">Subtotal:</td><td style="padding:0.6rem 0.5rem;text-align:right;color:#333;font-weight:600;">$${data.subtotal.toFixed(2)}</td></tr>
                        ${data.tax_rate > 0 ? `<tr><td colspan="3" style="padding:0.6rem 0.5rem;text-align:right;font-weight:600;color:#666;">Tax (${data.tax_rate}%):</td><td style="padding:0.6rem 0.5rem;text-align:right;color:#ff6b1a;font-weight:600;">$${data.tax.toFixed(2)}</td></tr>` : ''}
                        <tr style="background:#fff3e6;font-size:1.1rem;font-weight:700;"><td colspan="3" style="padding:0.8rem 0.5rem;text-align:right;color:#333;border-top:3px solid #ff6b1a;">Total Due:</td><td style="padding:0.8rem 0.5rem;text-align:right;color:#ff6b1a;border-top:3px solid #ff6b1a;">$${data.amount_due.toFixed(2)}</td></tr>
                        ${data.retainage_amount > 0 ? `<tr><td colspan="3" style="padding:0.45rem 0.5rem;text-align:right;font-weight:700;color:#dc2626;">Retainage (${data.retainage_rate}%):</td><td style="padding:0.45rem 0.5rem;text-align:right;color:#dc2626;font-weight:700;">$${data.retainage_amount.toFixed(2)}</td></tr>` : ''}
                    </tfoot>
                </table>
                ${data.notes ? `<div style="background:#f9f9f9;padding:1rem;border-radius:8px;margin-bottom:1rem;border-left:4px solid #ff6b1a;"><h3 style="color:#333;font-size:0.95rem;margin:0 0 0.5rem;">Notes</h3><div style="color:#666;white-space:pre-wrap;line-height:1.5;font-size:0.85rem;">${escapeHtml(data.notes)}</div></div>` : ''}
                <div style="text-align:center;padding:1rem 0;border-top:2px solid #eee;margin-top:1rem;"><p style="color:#666;margin:0;font-size:0.8rem;">Thank you for your business!</p><p style="color:#666;margin:0.3rem 0 0;font-size:0.8rem;">Payment is due by ${formatDate(data.due_date)}</p></div>
            </div>
        `;
    }

    function showPreview(invoice) {
        const existing = document.getElementById('unifiedInvoicePreviewModal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'unifiedInvoicePreviewModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:10000;overflow-y:auto;padding:2rem;';
        modal.innerHTML = `<div style="max-width:900px;margin:0 auto;background:#fff;border-radius:12px;position:relative;"><button id="closeUnifiedInvoicePreview" style="position:absolute;top:1rem;right:1rem;z-index:1;background:#dc143c;color:#fff;border:0;border-radius:50%;width:40px;height:40px;font-size:1.5rem;cursor:pointer;">X</button>${buildHtml(invoice)}<div style="padding:1rem 2rem 2rem;display:flex;gap:1rem;"><button id="printUnifiedInvoice" style="flex:1;padding:1rem;background:#3b82f6;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer;">Print / Save PDF</button><button id="closeUnifiedInvoicePreviewBottom" style="padding:1rem 2rem;background:#eee;color:#333;border:0;border-radius:8px;cursor:pointer;">Close</button></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#closeUnifiedInvoicePreview').onclick = () => modal.remove();
        modal.querySelector('#closeUnifiedInvoicePreviewBottom').onclick = () => modal.remove();
        modal.querySelector('#printUnifiedInvoice').onclick = () => printInvoice(invoice);
    }

    async function printInvoice(invoice) {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${escapeHtml(normalizeInvoice(invoice).invoice_number)}</title><style>@page{margin:0.5in}body{margin:0;background:#fff}</style></head><body>${buildHtml(invoice)}</body></html>`);
        printWindow.document.close();
        printWindow.focus();

        const images = Array.from(printWindow.document.images);
        await Promise.all(images.map(image => {
            if (image.complete && image.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            });
        }));

        printWindow.print();
    }

    window.invoiceTemplate = {
        normalizeInvoice,
        fromForm,
        buildHtml,
        showPreview,
        printInvoice
    };
})();

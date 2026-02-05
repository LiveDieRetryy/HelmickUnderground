// Check auth with JWT token
async function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/admin/index.html';
        return false;
    }
    
    try {
        const response = await fetch('/api/auth?action=verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/admin/index.html';
            return false;
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/admin/index.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin/index.html';
        return false;
    }
}

let currentCustomer = null;
let currentCustomerId = null;
let projects = [];
let currentFilter = 'all';

// Load customer details
async function loadCustomerDetails() {
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return;
    }
    
    // Get customer ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('id');
    
    if (customerId === null) {
        window.location.href = 'customers.html';
        return;
    }
    
    currentCustomerId = parseInt(customerId);
    
    try {
        // Load customer with projects and invoices in single request (optimized)
        const response = await fetch(`/api/customers?action=full&id=${currentCustomerId}`);
        if (!response.ok) throw new Error('Customer not found');
        
        const data = await response.json();
        currentCustomer = data.customer;
        projects = data.projects || [];
        
        // Display customer info
        displayCustomer(currentCustomer);
        
        // Display projects
        displayProjects();
        
        // Update stats with pre-calculated values
        updateCustomerStatsFromData(data.stats);
        
        // Check if we need to auto-open edit modal from URL parameter
        const editProjectId = urlParams.get('edit_project');
        if (editProjectId) {
            setTimeout(() => {
                editProject(parseInt(editProjectId));
                // Clean up URL without reloading page
                const newUrl = window.location.pathname + '?id=' + urlParams.get('id');
                window.history.replaceState({}, '', newUrl);
            }, 300);
        }
    } catch (error) {
        console.error('Error loading customer:', error);
        alert('Customer not found');
        window.location.href = 'customers.html';
    }
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
    
    if (customer.contact_person) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Contact Person</div>
                <div class="info-value">${customer.contact_person}</div>
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
    
    if (customer.preferred_contact) {
        contactHtml += `
            <div class="info-box">
                <div class="info-label">Preferred Contact</div>
                <div class="info-value" style="text-transform: capitalize;">${customer.preferred_contact}</div>
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
    
    // Stats section - will be updated with live data
    updateCustomerStats(customer);
    
    document.getElementById('statsSection').innerHTML = `
        <div class="stat-card">
            <div class="stat-value" id="totalJobsValue">-</div>
            <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="activeJobsValue">-</div>
            <div class="stat-label">Active Jobs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="completedJobsValue">-</div>
            <div class="stat-label">Completed Jobs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="invoicedAmountValue">-</div>
            <div class="stat-label">Invoiced Amount</div>
        </div>
    `;
    
    // Notes section
    if (customer.notes) {
        document.getElementById('notesSection').style.display = 'block';
        document.getElementById('notesContent').textContent = customer.notes;
    }
    
    // Custom line items section
    if (customer.custom_line_items && customer.custom_line_items.length > 0) {
        document.getElementById('lineItemsSection').style.display = 'block';
        
        const lineItemsHtml = customer.custom_line_items.map(item => `
            <tr>
                <td data-label="Description" style="color: var(--white); font-weight: 500;">${item.description}</td>
                <td data-label="Rate" style="color: var(--primary-color); font-weight: 700;">$${item.rate.toFixed(2)}</td>
            </tr>
        `).join('');
        
        document.getElementById('lineItemsTable').innerHTML = lineItemsHtml;
    }
}

// Edit customer
function editCustomer() {
    window.location.href = `customers.html?edit=${currentCustomerId}`;
}

// Create invoice for customer
function createInvoice() {
    // Store customer data in sessionStorage
    sessionStorage.setItem('invoiceCustomer', JSON.stringify({
        name: currentCustomer.name,
        email: currentCustomer.email,
        phone: currentCustomer.phone,
        address: currentCustomer.address,
        city: currentCustomer.city,
        state: currentCustomer.state,
        zip: currentCustomer.zip,
        contactPerson: currentCustomer.contact_person,
        customLineItems: currentCustomer.custom_line_items || []
    }));
    
    // Redirect to invoice page
    window.location.href = 'create-invoice.html';
}

// Delete customer
async function deleteCustomer() {
    if (confirm(`Are you sure you want to delete ${currentCustomer.name}?\n\nThis will permanently remove this customer from your database.`)) {
        try {
            const response = await fetch(`/api/customers?id=${currentCustomerId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete customer');
            
            alert('Customer deleted successfully');
            window.location.href = 'customers.html';
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('Error deleting customer');
        }
    }
}

// Update customer stats with live data
async function updateCustomerStats(customer) {
    // Stats are now loaded directly from the optimized API endpoint
    // This function is kept for backward compatibility but does nothing
    // The stats are set by updateCustomerStatsFromData() in loadCustomerDetails()
}

// Update customer stats with pre-calculated data from API
function updateCustomerStatsFromData(stats) {
    document.getElementById('totalJobsValue').textContent = stats.totalJobs;
    document.getElementById('activeJobsValue').textContent = stats.activeJobs;
    document.getElementById('completedJobsValue').textContent = stats.completedJobs;
    document.getElementById('invoicedAmountValue').textContent = `$${stats.totalInvoiced.toFixed(2)}`;
}

// Display projects with filtering
function displayProjects() {
    const filteredProjects = currentFilter === 'all' 
        ? projects 
        : projects.filter(p => p.status === currentFilter);
    
    const projectsGrid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('projectsEmptyState');
    
    if (filteredProjects.length === 0) {
        projectsGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    projectsGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    projectsGrid.innerHTML = filteredProjects.map(project => {
        const prints = project.prints || [];
        const redlines = project.redlines || [];
        const totalBilled = project.total_billed || 0;
        const totalEstimate = project.total_estimate || 0;
        
        return `
            <div class="project-card" onclick="viewProject(${project.id})">
                <div class="project-card-header">
                    <span class="project-number">#${project.project_number}</span>
                    <select class="project-status-dropdown status-${project.status}" 
                            onchange="updateProjectStatus(${project.id}, this.value, event)" 
                            onclick="event.stopPropagation()">
                        <option value="accepted" ${project.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                        <option value="ongoing" ${project.status === 'ongoing' ? 'selected' : ''}>Ongoing</option>
                        <option value="invoiced" ${project.status === 'invoiced' ? 'selected' : ''}>Invoiced</option>
                        <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="project-name">${project.project_name}</div>
                ${project.job_address ? `
                    <div class="project-address">
                        📍 ${project.job_address}${project.job_city ? `, ${project.job_city}` : ''}${project.job_state ? `, ${project.job_state}` : ''}
                    </div>
                ` : ''}
                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-label">Estimate</span>
                        <span class="project-meta-value">$${totalEstimate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Billed</span>
                        <span class="project-meta-value">$${totalBilled.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Prints</span>
                        <span class="project-meta-value">📄 ${prints.length}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Redlines</span>
                        <span class="project-meta-value">✏️ ${redlines.length}</span>
                    </div>
                </div>
                <div class="project-actions" onclick="event.stopPropagation()">
                    <button class="project-action-btn" onclick="deleteProject(${project.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filter projects by status
function filterProjects(status) {
    currentFilter = status;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });
    
    displayProjects();
}

// Open create project modal
function openCreateProjectModal() {
    document.getElementById('projectModalTitle').textContent = 'Create New Project';
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    selectedFiles = [];
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('projectModal').classList.add('active');
}

// Close project modal
function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('active');
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [...selectedFiles, ...files];
    displaySelectedFiles();
}

// Display selected files
function displaySelectedFiles() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-item-name">${file.name}</span>
            <button type="button" class="file-item-remove" onclick="removeFile(${index})">×</button>
        </div>
    `).join('');
}

// Remove file from selection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
}

// Save project
async function saveProject(event) {
    event.preventDefault();
    
    const customer = customers[currentCustomerIndex];
    const projectId = document.getElementById('projectId').value;
    
    const projectData = {
        project_number: document.getElementById('projectNumber').value,
        customer_id: customer.email,
        project_name: document.getElementById('projectName').value,
        job_address: document.getElementById('projectJobAddress').value,
        job_city: document.getElementById('projectJobCity').value,
        job_state: document.getElementById('projectJobState').value,
        description: document.getElementById('projectDescription').value,
        status: document.getElementById('projectStatus').value,
        start_date: document.getElementById('projectStartDate').value || null,
        estimated_completion: document.getElementById('projectEstimatedCompletion').value || null,
        total_estimate: parseFloat(document.getElementById('projectEstimate').value) || 0,
        notes: document.getElementById('projectNotes').value
    };
    
    try {
        let response;
        if (projectId) {
            // Update existing project
            response = await fetch(`/api/projects?project_id=${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
        } else {
            // Create new project
            response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
        }
        
        if (response.ok) {
            const savedProject = await response.json();
            
            // Handle file uploads if any
            if (selectedFiles.length > 0) {
                await uploadProjectFiles(savedProject.id);
            }
            
            // Show success notification
            showSuccessNotification(projectId ? 'Project updated successfully!' : 'Project created successfully!');
            
            closeProjectModal();
            await loadProjects();
            
            // Scroll to projects section
            setTimeout(() => {
                document.getElementById('projectsSection').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 300);
        } else {
            // Get error message from response
            const responseText = await response.text();
            let errorMessage = 'Failed to save project';
            
            try {
                const error = JSON.parse(responseText);
                errorMessage = error.error || error.message || responseText;
            } catch (e) {
                errorMessage = responseText || errorMessage;
            }
            
            console.error('Server error:', errorMessage);
            alert(`Error: ${errorMessage}`);
        }
    } catch (error) {
        console.error('Error saving project:', error);
        alert(`Failed to save project: ${error.message}`);
    }
}

// Upload project files
async function uploadProjectFiles(projectId) {
    if (selectedFiles.length === 0) return;
    
    const filePromises = selectedFiles.map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    fileName: file.name,
                    fileContent: e.target.result,
                    fileType: file.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    });
    
    try {
        const filesData = await Promise.all(filePromises);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: filesData,
                project_id: projectId,
                type: 'prints'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            // Update project with file URLs
            const currentProject = projects.find(p => p.id === projectId);
            const existingPrints = currentProject?.prints || [];
            
            await fetch(`/api/projects?project_id=${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prints: [...existingPrints, ...result.files]
                })
            });
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Some files failed to upload');
    }
}

// Edit project
async function editProject(projectId) {
    console.log('editProject called with projectId:', projectId);
    console.log('Available projects:', projects);
    console.log('Project IDs:', projects.map(p => p.id));
    
    const project = projects.find(p => p.id === projectId);
    console.log('Found project:', project);
    
    if (!project) {
        alert('Project not found!');
        return;
    }
    
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectNumber').value = project.project_number;
    document.getElementById('projectName').value = project.project_name;
    document.getElementById('projectJobAddress').value = project.job_address || '';
    document.getElementById('projectJobCity').value = project.job_city || '';
    document.getElementById('projectJobState').value = project.job_state || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('projectEstimate').value = project.total_estimate || '';
    document.getElementById('projectStartDate').value = project.start_date || '';
    document.getElementById('projectEstimatedCompletion').value = project.estimated_completion || '';
    document.getElementById('projectNotes').value = project.notes || '';
    
    selectedFiles = [];
    document.getElementById('fileList').innerHTML = '';
    
    document.getElementById('projectModal').classList.add('active');
}

// View project details
async function viewProject(projectId) {
    window.location.href = `project-details.html?id=${projectId}&customer_id=${currentCustomerIndex}`;
}

// Create invoice for project
function createInvoiceForProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    const customer = customers[currentCustomerIndex];
    
    if (!project) return;
    
    // Store project and customer data in sessionStorage
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
    
    sessionStorage.setItem('invoiceProject', JSON.stringify({
        id: project.id,
        project_number: project.project_number,
        project_name: project.project_name,
        job_address: project.job_address,
        job_city: project.job_city,
        job_state: project.job_state
    }));
    
    window.location.href = 'create-invoice.html';
}

// Update project status
async function updateProjectStatus(projectId, newStatus, event) {
    event.stopPropagation();
    
    try {
        const response = await fetch(`/api/projects?project_id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showSuccessNotification('Project status updated!');
            await loadProjects();
        } else {
            alert('Failed to update status');
            await loadProjects(); // Reload to reset dropdown
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status');
        await loadProjects(); // Reload to reset dropdown
    }
}

// Delete project
async function deleteProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (!confirm(`Are you sure you want to delete project #${project.project_number}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects?project_id=${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Project deleted successfully');
            loadProjects();
        } else {
            alert('Failed to delete project');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project');
    }
}

// Load projects when page loads
setTimeout(() => {
    loadProjects();
}, 500);

// Success notification function
function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    const messageEl = document.getElementById('successMessage');
    
    messageEl.textContent = message;
    notification.style.display = 'block';
    notification.style.animation = 'slideIn 0.3s ease';
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

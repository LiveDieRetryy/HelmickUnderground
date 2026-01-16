// Admin credentials (case sensitive)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'HUAdmin';

// Check if user is logged in
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (isLoggedIn) {
        showDashboard();
    }
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        showDashboard();
    } else {
        errorDiv.textContent = 'Invalid username or password. Please try again.';
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', function() {
    sessionStorage.removeItem('adminLoggedIn');
    location.reload();
});

// Show dashboard
function showDashboard() {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadGalleryItems();
}

// Type selector
const typeBtns = document.querySelectorAll('.type-btn');
const imageUrlGroup = document.getElementById('imageUrlGroup');
const embedCodeGroup = document.getElementById('embedCodeGroup');
const itemImage = document.getElementById('itemImage');
const itemEmbed = document.getElementById('itemEmbed');

typeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        typeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const type = this.dataset.type;
        if (type === 'image') {
            imageUrlGroup.style.display = 'block';
            embedCodeGroup.style.display = 'none';
            itemImage.required = true;
            itemEmbed.required = false;
        } else {
            imageUrlGroup.style.display = 'none';
            embedCodeGroup.style.display = 'block';
            itemImage.required = false;
            itemEmbed.required = true;
        }
    });
});

// Add item form handler
document.getElementById('addItemForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const type = document.querySelector('.type-btn.active').dataset.type;
    const title = document.getElementById('itemTitle').value;
    const description = document.getElementById('itemDescription').value;
    const date = document.getElementById('itemDate').value;
    
    const newItem = {
        id: Date.now(),
        type: type,
        title: title,
        description: description,
        date: date || null
    };
    
    if (type === 'image') {
        newItem.image = document.getElementById('itemImage').value;
    } else {
        const embedCode = document.getElementById('itemEmbed').value;
        // Validate TikTok embed code
        if (!embedCode.includes('tiktok-embed') || !embedCode.includes('<blockquote')) {
            alert('❌ Invalid TikTok embed code!\n\nMake sure you:\n1. Go to your TikTok VIDEO (not music)\n2. Click Share → Embed\n3. Copy the FULL code starting with <blockquote>\n\nThe code should contain "tiktok-embed" and "blockquote"');
            return;
        }
        newItem.embedCode = embedCode;
    }
    
    // Add to gallery data
    await addGalleryItem(newItem);
    
    // Reset form
    this.reset();
    typeBtns[0].click(); // Reset to image type
    
    // Show success message
    showSuccess('Item added successfully! Remember to upload your changes.');
    
    // Reload items list
    loadGalleryItems();
});

// Load gallery items
async function loadGalleryItems() {
    try {
        const response = await fetch('/api/gallery');
        const data = await response.json();
        const container = document.getElementById('galleryItemsList');
        
        if (!data.items || data.items.length === 0) {
            container.innerHTML = '<p style="color: var(--gray); text-align: center; padding: 2rem;">No gallery items yet. Add your first item above!</p>';
            return;
        }
        
        container.innerHTML = data.items.map(item => `
            <div class="gallery-item-row" data-id="${item.id}">
                ${item.type === 'image' 
                    ? `<img src="${item.image}" alt="${item.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect fill=\'%23333\' width=\'100\' height=\'100\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23666\' font-family=\'Arial\' font-size=\'12\'%3ENo Image%3C/text%3E%3C/svg%3E'">`
                    : `<div class="video-thumb">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                       </div>`
                }
                <div class="item-info">
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                    ${item.date ? `<p><strong>Date:</strong> ${item.date}</p>` : ''}
                    <p><strong>Type:</strong> ${item.type === 'image' ? '📷 Image' : '🎥 Video'}</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-small btn-delete" onclick="deleteItem(${item.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading gallery items:', error);
    }
}

// Add gallery item
async function addGalleryItem(item) {
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'add',
                item: item
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add item');
        }
        
        const result = await response.json();
        showSuccess('✅ Item added successfully! It\'s now live for everyone to see!');
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Error adding item. Please try again.');
    }
}

// Get gallery data from localStorage or JSON file
function getGalleryData() {
    const localData = localStorage.getItem('helmick_gallery_data');
    if (localData) {
        return JSON.parse(localData);
    }
    return { items: [] };
}

// Save gallery data to localStorage
function saveGalleryData(data) {
    localStorage.setItem('helmick_gallery_data', JSON.stringify(data));
}

// Delete item
async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'delete',
                item: { id: id }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete item');
        }e
        saveGalleryData(data);
        
        showSuccess('✅ Item deleted successfully!');
        loadGalleryItems();
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item. Please try again.');
    }
}

// Download JSON file
function downloadJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gallery-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('✅ SUCCESS! File downloaded to your Downloads folder.\n\n📁 NEXT STEPS:\n1. Move gallery-data.json to: C:\\Users\\Admin\\HelmickUnderground\n2. Replace the existing file\n3. Run: git add . && git commit -m "Update gallery" && git push\n4. Wait 30 seconds and check your gallery!');
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Make deleteItem available globally
window.deleteItem = deleteItem;

// Check auth on page load
checkAuth();

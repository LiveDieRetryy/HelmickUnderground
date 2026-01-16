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
    setupDragAndDrop();
}

// Drag and drop functionality
function setupDragAndDrop() {
    const imageDropZone = document.getElementById('imageDropZone');
    const videoDropZone = document.getElementById('videoDropZone');
    const imageInput = document.getElementById('itemImageFile');
    const videoInput = document.getElementById('itemVideoFile');
    const imageFileName = document.getElementById('imageFileName');
    const videoFileName = document.getElementById('videoFileName');

    // Setup image drop zone
    if (imageDropZone && imageInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, () => {
                imageDropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            imageDropZone.addEventListener(eventName, () => {
                imageDropZone.classList.remove('drag-over');
            }, false);
        });

        imageDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                imageInput.files = files;
                imageFileName.textContent = `✓ ${files[0].name}`;
                imageFileName.style.display = 'block';
            }
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                imageFileName.textContent = `✓ ${e.target.files[0].name}`;
                imageFileName.style.display = 'block';
            } else {
                imageFileName.style.display = 'none';
            }
        });
    }

    // Setup video drop zone
    if (videoDropZone && videoInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, () => {
                videoDropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            videoDropZone.addEventListener(eventName, () => {
                videoDropZone.classList.remove('drag-over');
            }, false);
        });

        videoDropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                videoInput.files = files;
                videoFileName.textContent = `✓ ${files[0].name}`;
                videoFileName.style.display = 'block';
            }
        });

        videoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                videoFileName.textContent = `✓ ${e.target.files[0].name}`;
                videoFileName.style.display = 'block';
            } else {
                videoFileName.style.display = 'none';
            }
        });
    }
}

// Type selector
const typeBtns = document.querySelectorAll('.type-btn');
const imageUploadGroup = document.getElementById('imageUploadGroup');
const videoUploadGroup = document.getElementById('videoUploadGroup');
const embedCodeGroup = document.getElementById('embedCodeGroup');
const itemImageFile = document.getElementById('itemImageFile');
const itemVideoFile = document.getElementById('itemVideoFile');
const itemEmbed = document.getElementById('itemEmbed');

typeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        typeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const type = this.dataset.type;
        
        // Hide all
        imageUploadGroup.style.display = 'none';
        videoUploadGroup.style.display = 'none';
        embedCodeGroup.style.display = 'none';
        
        // Reset required
        itemImageFile.required = false;
        itemVideoFile.required = false;
        itemEmbed.required = false;
        
        // Show appropriate input
        if (type === 'image') {
            imageUploadGroup.style.display = 'block';
            itemImageFile.required = true;
        } else if (type === 'video') {
            videoUploadGroup.style.display = 'block';
            embedCodeGroup.style.display = 'block';
            embedCodeGroup.querySelector('label').textContent = 'Or TikTok Embed Code';
        } else if (type === 'tiktok') {
            embedCodeGroup.style.display = 'block';
            embedCodeGroup.querySelector('label').textContent = 'TikTok Embed Code *';
            itemEmbed.required = true;
        }
    });
});

// Drag and drop functionality
function setupDropZone(dropZoneId, fileInputId, fileNameDisplayId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);
    const fileNameDisplay = document.getElementById(fileNameDisplayId);
    
    if (!dropZone || !fileInput) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            displayFileName(files[0], fileNameDisplay);
        }
    }, false);
    
    // Handle file selection via click
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            displayFileName(e.target.files[0], fileNameDisplay);
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function displayFileName(file, displayElement) {
    if (displayElement) {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        displayElement.textContent = `✓ ${file.name} (${sizeInMB}MB)`;
        displayElement.style.display = 'block';
    }
}

// Initialize drop zones
setupDropZone('imageDropZone', 'itemImageFile', 'imageFileName');
setupDropZone('videoDropZone', 'itemVideoFile', 'videoFileName');

// Add item form handler
document.getElementById('addItemForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const type = document.querySelector('.type-btn.active').dataset.type;
    const title = document.getElementById('itemTitle').value;
    const description = document.getElementById('itemDescription').value;
    const date = document.getElementById('itemDate').value;
    
    const newItem = {
        id: Date.now(),
        title: title,
        description: description,
        date: date || null
    };
    
    try {
        // Handle different types
        if (type === 'image') {
            const file = document.getElementById('itemImageFile').files[0];
            if (!file) {
                alert('Please select an image');
                return;
            }
            
            // Check size
            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be under 5MB');
                return;
            }
            
            showSuccess('⏳ Uploading image...');
            const uploadedPath = await uploadFile(file);
            newItem.type = 'image';
            newItem.image = uploadedPath;
            newItem.fileSize = file.size;
            
        } else if (type === 'video') {
            const videoFile = document.getElementById('itemVideoFile').files[0];
            const embedCode = document.getElementById('itemEmbed').value;
            
            if (embedCode) {
                // TikTok embed
                newItem.type = 'video';
                newItem.embedCode = embedCode;
            } else if (videoFile) {
                // Direct upload - compress if needed
                let fileToUpload = videoFile;
                const MAX_SIZE = 6 * 1024 * 1024; // 6MB to account for base64 overhead (~33%)
                
                if (videoFile.size > MAX_SIZE) {
                    showSuccess('⏳ Video is too large. Compressing... This may take a few minutes...');
                    try {
                        fileToUpload = await compressVideo(videoFile, MAX_SIZE);
                        if (!fileToUpload) {
                            throw new Error('Compression returned no file');
                        }
                        const compressedSizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(2);
                        showSuccess(`✅ Compressed to ${compressedSizeMB}MB! Uploading...`);
                    } catch (compressError) {
                        console.error('Compression error:', compressError);
                        alert('⚠️ Video too large to compress.\n\nOptions:\n1. Upload a shorter clip (30-45 seconds max)\n2. Use lower quality source video\n3. Use TikTok embed for longer videos');
                        return;
                    }
                } else {
                    showSuccess('⏳ Uploading video...');
                }
                
                try {
                    const uploadedPath = await uploadFile(fileToUpload);
                    newItem.type = 'video';
                    newItem.videoFile = uploadedPath;
                    newItem.fileSize = fileToUpload.size;
                } catch (uploadError) {
                    console.error('Upload error:', uploadError);
                    alert('Upload failed: ' + uploadError.message);
                    return;
                }
            } else {
                alert('Please either upload a video file or paste a TikTok embed code');
                return;
            }
            
        } else if (type === 'tiktok') {
            const embedCode = document.getElementById('itemEmbed').value;
            if (!embedCode) {
                alert('Please paste the TikTok embed code');
                return;
            }
            newItem.type = 'video';
            newItem.embedCode = embedCode;
        }
        
        // Add to gallery data
        await addGalleryItem(newItem);
        
        // Reset form
        this.reset();
        typeBtns[0].click(); // Reset to image type
        
        // Reload items list
        loadGalleryItems();
        
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Error adding item: ' + error.message);
    }
});

// Upload file to GitHub
async function uploadFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileContent: e.target.result,
                        fileType: file.type
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Upload failed');
                }
                
                const result = await response.json();
                resolve(result.path);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Compress video to fit within target size
async function compressVideo(file, targetSizeBytes) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        
        video.onerror = (e) => {
            console.error('Video load error:', e);
            reject(new Error('Failed to load video file'));
        };
        
        video.onloadedmetadata = async function() {
            try {
                console.log(`Original video: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
                
                // Create canvas with reduced resolution
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate scale to reduce to 720p max
                const maxWidth = 1280;
                const maxHeight = 720;
                let scale = 1;
                
                if (video.videoWidth > maxWidth || video.videoHeight > maxHeight) {
                    scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight);
                }
                
                canvas.width = Math.floor(video.videoWidth * scale);
                canvas.height = Math.floor(video.videoHeight * scale);
                
                console.log(`Compressed size: ${canvas.width}x${canvas.height}`);
                
                // Calculate target bitrate
                const durationSeconds = video.duration;
                const targetSizeMB = targetSizeBytes / (1024 * 1024);
                const targetBitrate = Math.floor((targetSizeMB * 8 * 1024 * 1024) / durationSeconds * 0.75); // Use 75% for safety
                const videoBitrate = Math.min(800000, Math.max(200000, targetBitrate)); // Between 200kbps and 800kbps
                
                console.log(`Target bitrate: ${videoBitrate} bps`);
                
                // Check if MediaRecorder is supported
                if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    reject(new Error('Video compression not supported in this browser'));
                    return;
                }
                
                const stream = canvas.captureStream(25); // 25 fps
                const chunks = [];
                
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'video/webm;codecs=vp8',
                    videoBitsPerSecond: videoBitrate
                });
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    console.log(`Compressed video size: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);
                    
                    if (blob.size > targetSizeBytes * 1.1) {
                        reject(new Error(`Compressed size (${(blob.size / (1024 * 1024)).toFixed(2)}MB) still too large. Try a shorter video.`));
                    } else {
                        const compressedFile = new File([blob], 
                            file.name.replace(/\.[^/.]+$/, '.webm'), 
                            { type: 'video/webm' }
                        );
                        resolve(compressedFile);
                    }
                };
                
                mediaRecorder.onerror = (e) => {
                    console.error('MediaRecorder error:', e);
                    reject(new Error('Compression failed'));
                };
                
                // Start recording
                mediaRecorder.start(100); // Collect data every 100ms
                
                // Play and draw video frames
                await video.play();
                
                let frameCount = 0;
                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frameCount++;
                        requestAnimationFrame(drawFrame);
                    }
                };
                
                video.addEventListener('ended', () => {
                    console.log(`Processed ${frameCount} frames`);
                    setTimeout(() => {
                        mediaRecorder.stop();
                    }, 500);
                });
                
                drawFrame();
                
            } catch (err) {
                console.error('Compression error:', err);
                reject(err);
            }
        };
        
        // Load video
        video.src = URL.createObjectURL(file);
        video.load();
    });
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Load gallery items
async function loadGalleryItems() {
    try {
        const response = await fetch('/api/gallery');
        const data = await response.json();
        const container = document.getElementById('galleryItemsList');
        
        // Store items globally for edit modal
        galleryItems = data.items || [];
        
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
                    <p><strong>Type:</strong> ${item.type === 'image' ? '📷 Image' : '🎥 Video'}${item.fileSize ? ` • ${formatFileSize(item.fileSize)}` : ''}</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-small btn-edit" onclick="openEditModal(${item.id})">Edit</button>
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
            let errorMessage = 'Failed to add item';
            
            // Try to parse JSON error, fallback to text
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } else {
                const errorText = await response.text();
                if (errorText.includes('Request Entity Too Large') || response.status === 413) {
                    errorMessage = 'File too large for upload. The compressed video is still over the 10MB limit. Please try:\n1. A shorter video clip\n2. Lower quality source video\n3. Use TikTok embed instead';
                } else {
                    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                }
            }
            
            if (errorMessage.includes('GitHub token not configured')) {
                alert('⚠️ SETUP REQUIRED:\n\nThe gallery admin needs a GitHub token to work.\n\nPlease follow these steps:\n\n1. Read GITHUB_TOKEN_SETUP.txt in your project folder\n2. Create a GitHub Personal Access Token\n3. Add it to Vercel environment variables\n4. Redeploy\n\nThis is a one-time setup that takes 5 minutes.');
                return;
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        showSuccess('✅ Item added successfully! It\'s now live for everyone to see!');
    } catch (error) {
        console.error('Error adding item:', error);
        throw error; // Re-throw so the calling function can handle it
    }
}

// Delete item
async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/gallery', {
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
        }
        
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

// Edit item functions
let galleryItems = [];

function openEditModal(id) {
    const item = galleryItems.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemTitle').value = item.title;
    document.getElementById('editItemDescription').value = item.description;
    document.getElementById('editItemDate').value = item.date || '';
    
    document.getElementById('editModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('editItemForm').reset();
}

// Handle edit form submission
document.getElementById('editItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = parseInt(document.getElementById('editItemId').value);
    const title = document.getElementById('editItemTitle').value;
    const description = document.getElementById('editItemDescription').value;
    const date = document.getElementById('editItemDate').value;
    
    try {
        const response = await fetch('/api/gallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'edit',
                item: {
                    id: id,
                    title: title,
                    description: description,
                    date: date
                }
            })
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Server error: ${text}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Item updated successfully!');
            closeEditModal();
            loadGalleryItems();
        } else {
            alert('Failed to update item: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating item:', error);
        alert('Error updating item: ' + error.message);
    }
});

// Close modal when clicking outside
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('editModal').classList.contains('active')) {
        closeEditModal();
    }
});

// Make functions available globally
window.deleteItem = deleteItem;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;

// Check auth on page load
checkAuth();

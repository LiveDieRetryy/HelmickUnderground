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
                
                if (videoFile.size > 10 * 1024 * 1024) {
                    showSuccess('⏳ Video is too large. Compressing... This may take a few minutes...');
                    try {
                        fileToUpload = await compressVideo(videoFile, 10 * 1024 * 1024);
                        showSuccess('✅ Compression complete! Uploading...');
                    } catch (compressError) {
                        alert('Could not compress video enough. Try a shorter clip or use TikTok embed for longer videos.');
                        return;
                    }
                } else {
                    showSuccess('⏳ Uploading video...');
                }
                
                const uploadedPath = await uploadFile(fileToUpload);
                newItem.type = 'video';
                newItem.videoFile = uploadedPath;
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
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadedmetadata = function() {
            // Set canvas size (compress resolution to 720p max)
            const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
            canvas.width = video.videoWidth * scale;
            canvas.height = video.videoHeight * scale;
            
            const chunks = [];
            const stream = canvas.captureStream(30); // 30 fps
            
            // Try different bitrates until we get under target size
            let videoBitrate = 1500000; // Start at 1.5 Mbps
            const targetSizeMB = targetSizeBytes / (1024 * 1024);
            const durationSeconds = video.duration;
            
            // Estimate bitrate needed (with some overhead for audio)
            const estimatedBitrate = Math.floor((targetSizeMB * 8 * 1024 * 1024) / durationSeconds * 0.8);
            videoBitrate = Math.min(videoBitrate, estimatedBitrate);
            
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: videoBitrate
            });
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                
                if (blob.size > targetSizeBytes) {
                    reject(new Error('Unable to compress video small enough'));
                } else {
                    // Convert to File object
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webm'), {
                        type: 'video/webm'
                    });
                    resolve(compressedFile);
                }
            };
            
            // Draw video frames to canvas and record
            video.play();
            mediaRecorder.start();
            
            const drawFrame = () => {
                if (!video.paused && !video.ended) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    requestAnimationFrame(drawFrame);
                } else {
                    mediaRecorder.stop();
                }
            };
            
            video.addEventListener('ended', () => {
                mediaRecorder.stop();
            });
            
            drawFrame();
        };
        
        video.onerror = () => reject(new Error('Failed to load video'));
        video.src = URL.createObjectURL(file);
    });
}

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
            const error = await response.json();
            if (error.error && error.error.includes('GitHub token not configured')) {
                alert('⚠️ SETUP REQUIRED:\n\nThe gallery admin needs a GitHub token to work.\n\nPlease follow these steps:\n\n1. Read GITHUB_TOKEN_SETUP.txt in your project folder\n2. Create a GitHub Personal Access Token\n3. Add it to Vercel environment variables\n4. Redeploy\n\nThis is a one-time setup that takes 5 minutes.');
                return;
            }
            throw new Error(error.error || 'Failed to add item');
        }
        
        const result = await response.json();
        showSuccess('✅ Item added successfully! It\'s now live for everyone to see!');
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Error adding item: ' + error.message + '\n\nIf you see "GitHub token not configured", please check GITHUB_TOKEN_SETUP.txt for setup instructions.');
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

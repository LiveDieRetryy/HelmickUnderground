// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
}

let canvas, ctx, imageCanvas, imageCtx;
let isDrawing = false;
let currentTool = 'select';
let currentColor = '#ff0000';
let currentWidth = 3;
let startX, startY;
let shapes = []; // Store all shapes as objects
let selectedShape = null;
let dragMode = null;
let dragStartX, dragStartY;
let originalShape = null;

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const useSessionStorage = urlParams.get('useSessionStorage') === 'true';
const imageUrl = useSessionStorage ? sessionStorage.getItem('redlineImage') : urlParams.get('image');
const projectId = urlParams.get('project_id');
const customerId = urlParams.get('customer_id');
const fileName = urlParams.get('filename');

// Initialize
function init() {
    if (!imageUrl) {
        alert('No image specified');
        window.history.back();
        return;
    }

    document.getElementById('fileName').textContent = decodeURIComponent(fileName || 'Redline Editor');
    
    imageCanvas = document.getElementById('imageCanvas');
    imageCtx = imageCanvas.getContext('2d');
    
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    
    // Load image
    loadImage(decodeURIComponent(imageUrl));
    
    // Setup event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
    
    // Prevent browser zoom on wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // Touch support
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', handleMouseUp);
    
    // Color picker
    document.getElementById('colorPicker').addEventListener('change', (e) => {
        currentColor = e.target.value;
        if (selectedShape) {
            selectedShape.color = currentColor;
            redraw();
        }
    });
    
    // Stroke width
    document.getElementById('strokeWidth').addEventListener('change', (e) => {
        currentWidth = parseInt(e.target.value);
        if (selectedShape) {
            selectedShape.width = currentWidth;
            redraw();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedShape) {
            deleteSelected();
        }
        if (e.key === 'Escape') {
            selectedShape = null;
            redraw();
        }
    });
}

// Load image
function loadImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Convert GitHub URL to raw if needed
    let loadUrl = url;
    if (!url.startsWith('data:') && url.includes('github.com')) {
        if (url.includes('/blob/')) {
            loadUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }
    }
    
    img.onload = function() {
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        canvas.width = img.width;
        canvas.height = img.height;
        
        console.log('Image loaded:', img.width, 'x', img.height);
        console.log('Canvas size:', canvas.width, 'x', canvas.height);
        
        imageCtx.drawImage(img, 0, 0);
        redraw();
    };
    
    img.onerror = function(error) {
        console.error('Failed to load image:', error);
        alert('Failed to load image. Please check the URL or try again.');
    };
    
    img.src = loadUrl;
}

// Select tool
function selectTool(tool) {
    currentTool = tool;
    selectedShape = null;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (toolBtn) {
        toolBtn.classList.add('active');
    }
    
    // Update cursor
    if (canvas) {
        canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    }
    
    redraw();
}

// Get mouse position
function getMousePos(e) {
    // Get the canvas's position and size on screen
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert screen coordinates to canvas coordinates
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    console.log('Mouse click:', {
        screenX: e.clientX,
        screenY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        scaleX: scaleX,
        scaleY: scaleY,
        calculatedX: x,
        calculatedY: y
    });
    
    return { x, y };
}

// Handle touch events
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// Mouse down
function handleMouseDown(e) {
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    
    // Middle mouse button or Ctrl+Click for panning
        // Check if clicking on a handle
        if (selectedShape) {
            const handle = getHandleAt(pos.x, pos.y);
            if (handle) {
                dragMode = handle;
                dragStartX = pos.x;
                dragStartY = pos.y;
                originalShape = JSON.parse(JSON.stringify(selectedShape));
                return;
            }
        }
        
        // Check if clicking on a shape
        const clickedShape = getShapeAt(pos.x, pos.y);
        if (clickedShape) {
            selectedShape = clickedShape;
            dragMode = 'move';
            dragStartX = pos.x;
            dragStartY = pos.y;
            originalShape = JSON.parse(JSON.stringify(selectedShape));
            redraw();
        } else {
            selectedShape = null;
            redraw();
        }
    } else if (currentTool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
            shapes.push({
                type: 'text',
                x: pos.x,
                y: pos.y,
                text: text,
                color: currentColor,
                width: currentWidth,
                fontSize: currentWidth * 8
            });
            redraw();
        }
    } else if (currentTool === 'eraser') {
        const shapeToDelete = getShapeAt(pos.x, pos.y);
        if (shapeToDelete) {
            shapes = shapes.filter(s => s !== shapeToDelete);
            redraw();
        }
    } else {
        isDrawing = true;
    }
}

// Mouse move
function handleMouseMove(e) {
    if (isPanning) {
        offsetX = e.clientX - panStartX;
        offsetY = e.clientY - panStartY;
        applyTransform();
        return;
    }
    
    const pos = getMousePos(e);
    
    if (currentTool === 'select' && dragMode) {
        const dx = pos.x - dragStartX;
                selectedShape.x2 = originalShape.x2 + dx;
                selectedShape.y2 = originalShape.y2 + dy;
            } else if (selectedShape.type === 'pen') {
                selectedShape.points = originalShape.points.map(p => ({
                    x: p.x + dx,
                    y: p.y + dy
                }));
            }
        } else if (dragMode.startsWith('resize-')) {
            handleResize(pos.x, pos.y);
        } else if (dragMode === 'rotate') {
            handleRotate(pos.x, pos.y);
        }
        
        redraw();
    } else if (isDrawing && currentTool !== 'text' && currentTool !== 'eraser') {
        if (currentTool === 'pen') {
            // For pen, continuously add to current shape
            if (!shapes.length || shapes[shapes.length - 1].type !== 'pen' || !isDrawing) {
                shapes.push({
                    type: 'pen',
                    points: [{x: startX, y: startY}],
                    color: currentColor,
                    width: currentWidth
                });
            }
            shapes[shapes.length - 1].points.push({x: pos.x, y: pos.y});
        }
        redraw();
        
        // Draw preview for shapes
        if (currentTool !== 'pen') {
            drawShapePreview(startX, startY, pos.x, pos.y);
        }
    } else if (currentTool === 'select') {
        // Update cursor based on what's under mouse
        const handle = selectedShape ? getHandleAt(pos.x, pos.y) : null;
        if (handle) {
            canvas.style.cursor = getHandleCursor(handle);
        } else if (getShapeAt(pos.x, pos.y)) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    }
}

// Mouse up
function handleMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = currentTool === 'select' ? 'default' : 'crosshair';
    }
    
    if (isDrawing && currentTool !== 'pen') {
        const pos = getMousePos(e);
        
        if (currentTool === 'line') {
            shapes.push({
                type: 'line',
                x: startX,
                y: startY,
                x2: pos.x,
                y2: pos.y,
                color: currentColor,
                width: currentWidth
                y: Math.min(startY, pos.y),
                width: Math.abs(pos.x - startX),
                height: Math.abs(pos.y - startY),
                color: currentColor,
                strokeWidth: currentWidth,
                rotation: 0
            });
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
            shapes.push({
                type: 'circle',
                x: startX,
                y: startY,
                radius: radius,
                color: currentColor,
                width: currentWidth,
                rotation: 0
            });
        }
        
        redraw();
    }
    
    isDrawing = false;
    dragMode = null;
    originalShape = null;
}

// Handle resize
function handleResize(mx, my) {
    if (selectedShape.type === 'rectangle') {
        const dx = mx - dragStartX;
        const dy = my - dragStartY;
        
        if (dragMode === 'resize-tl') {
            selectedShape.x = originalShape.x + dx;
            selectedShape.y = originalShape.y + dy;
            selectedShape.width = originalShape.width - dx;
            selectedShape.height = originalShape.height - dy;
        } else if (dragMode === 'resize-tr') {
            selectedShape.y = originalShape.y + dy;
            selectedShape.width = originalShape.width + dx;
            selectedShape.height = originalShape.height - dy;
        } else if (dragMode === 'resize-bl') {
            selectedShape.x = originalShape.x + dx;
            selectedShape.width = originalShape.width - dx;
            selectedShape.height = originalShape.height + dy;
        } else if (dragMode === 'resize-br') {
            selectedShape.width = originalShape.width + dx;
            selectedShape.height = originalShape.height + dy;
        }
        
        // Prevent negative dimensions
        if (selectedShape.width < 10) selectedShape.width = 10;
        if (selectedShape.height < 10) selectedShape.height = 10;
    } else if (selectedShape.type === 'circle') {
        const newRadius = Math.sqrt(Math.pow(mx - selectedShape.x, 2) + Math.pow(my - selectedShape.y, 2));
        selectedShape.radius = Math.max(10, newRadius);
    } else if (selectedShape.type === 'line') {
        if (dragMode === 'resize-start') {
            selectedShape.x = mx;
            selectedShape.y = my;
        } else if (dragMode === 'resize-end') {
            selectedShape.x2 = mx;
            selectedShape.y2 = my;
        }
    }
}

// Handle rotate
function handleRotate(mx, my) {
    if (selectedShape.type === 'rectangle' || selectedShape.type === 'circle') {
        const centerX = selectedShape.type === 'rectangle' 
            ? selectedShape.x + selectedShape.width / 2 
            : selectedShape.x;
        const centerY = selectedShape.type === 'rectangle' 
            ? selectedShape.y + selectedShape.height / 2 
            : selectedShape.y;
        
        const angle = Math.atan2(my - centerY, mx - centerX);
        selectedShape.rotation = angle;
    }
}

// Get shape at position
function getShapeAt(x, y) {
    // Check in reverse order (top to bottom)
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        
        if (shape.type === 'rectangle') {
            const hw = shape.width / 2;
            const hh = shape.height / 2;
            const cx = shape.x + hw;
            const cy = shape.y + hh;
            
            // Simple AABB check (could be improved for rotation)
            if (x >= shape.x && x <= shape.x + shape.width &&
                y >= shape.y && y <= shape.y + shape.height) {
                return shape;
            }
        } else if (shape.type === 'circle') {
            const dist = Math.sqrt(Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2));
            if (dist <= shape.radius) {
                return shape;
            }
        } else if (shape.type === 'line') {
            const dist = distanceToLine(x, y, shape.x, shape.y, shape.x2, shape.y2);
            if (dist < shape.width + 5) {
                return shape;
            }
        } else if (shape.type === 'text') {
            ctx.font = `${shape.fontSize}px Arial`;
            const metrics = ctx.measureText(shape.text);
            const textWidth = metrics.width;
            const textHeight = shape.fontSize;
            
            if (x >= shape.x && x <= shape.x + textWidth &&
                y >= shape.y - textHeight && y <= shape.y) {
                return shape;
            }
        } else if (shape.type === 'pen') {
            for (let point of shape.points) {
                const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
                if (dist < shape.width + 5) {
                    return shape;
                }
            }
        }
    }
    return null;
}

// Distance from point to line segment
function distanceToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Get handle at position
function getHandleAt(x, y) {
    if (!selectedShape) return null;
    
    const handleSize = 8;
    
    if (selectedShape.type === 'rectangle') {
        const handles = {
            'resize-tl': { x: selectedShape.x, y: selectedShape.y },
            'resize-tr': { x: selectedShape.x + selectedShape.width, y: selectedShape.y },
            'resize-bl': { x: selectedShape.x, y: selectedShape.y + selectedShape.height },
            'resize-br': { x: selectedShape.x + selectedShape.width, y: selectedShape.y + selectedShape.height },
            'rotate': { x: selectedShape.x + selectedShape.width / 2, y: selectedShape.y - 20 }
        };
        
        for (let [name, pos] of Object.entries(handles)) {
            if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
                return name;
            }
        }
    } else if (selectedShape.type === 'circle') {
        const resizeX = selectedShape.x + selectedShape.radius;
        const resizeY = selectedShape.y;
        if (Math.abs(x - resizeX) < handleSize && Math.abs(y - resizeY) < handleSize) {
            return 'resize-br';
        }
        
        const rotateX = selectedShape.x;
        const rotateY = selectedShape.y - selectedShape.radius - 20;
        if (Math.abs(x - rotateX) < handleSize && Math.abs(y - rotateY) < handleSize) {
            return 'rotate';
        }
    } else if (selectedShape.type === 'line') {
        if (Math.abs(x - selectedShape.x) < handleSize && Math.abs(y - selectedShape.y) < handleSize) {
            return 'resize-start';
        }
        if (Math.abs(x - selectedShape.x2) < handleSize && Math.abs(y - selectedShape.y2) < handleSize) {
            return 'resize-end';
        }
    }
    
    return null;
}

// Get cursor for handle
function getHandleCursor(handle) {
    if (handle === 'rotate') return 'grab';
    if (handle === 'move') return 'move';
    if (handle === 'resize-tl' || handle === 'resize-br') return 'nwse-resize';
    if (handle === 'resize-tr' || handle === 'resize-bl') return 'nesw-resize';
    if (handle === 'resize-start' || handle === 'resize-end') return 'move';
    return 'default';
}

// Draw shape preview
function drawShapePreview(x1, y1, x2, y2) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentWidth;
    ctx.setLineDash([5, 5]);
    
    if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else if (currentTool === 'rectangle') {
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
}

// Redraw canvas
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all shapes
    for (let shape of shapes) {
        drawShape(shape, shape === selectedShape);
    }
    
    // Draw selection handles
    if (selectedShape) {
        drawSelectionHandles(selectedShape);
    }
}

// Draw a single shape
function drawShape(shape, isSelected) {
    ctx.save();
    
    if (shape.type === 'pen') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (shape.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            ctx.stroke();
        }
    } else if (shape.type === 'line') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
    } else if (shape.type === 'rectangle') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.strokeWidth;
        
        if (shape.rotation) {
            ctx.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
            ctx.rotate(shape.rotation);
            ctx.strokeRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
        } else {
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
    } else if (shape.type === 'circle') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
    } else if (shape.type === 'text') {
        ctx.fillStyle = shape.color;
        ctx.font = `${shape.fontSize}px Arial`;
        ctx.fillText(shape.text, shape.x, shape.y);
    }
    
    ctx.restore();
}

// Draw selection handles
function drawSelectionHandles(shape) {
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    const handleSize = 8;
    
    if (shape.type === 'rectangle') {
        // Corner handles
        const handles = [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x, y: shape.y + shape.height },
            { x: shape.x + shape.width, y: shape.y + shape.height }
        ];
        
        for (let handle of handles) {
            ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        }
        
        // Rotate handle
        const rotateX = shape.x + shape.width / 2;
        const rotateY = shape.y - 20;
        ctx.beginPath();
        ctx.arc(rotateX, rotateY, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Line to rotate handle
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        ctx.lineTo(rotateX, rotateY);
        ctx.stroke();
        ctx.setLineDash([]);
    } else if (shape.type === 'circle') {
        // Resize handle
        const resizeX = shape.x + shape.radius;
        const resizeY = shape.y;
        ctx.fillRect(resizeX - handleSize / 2, resizeY - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(resizeX - handleSize / 2, resizeY - handleSize / 2, handleSize, handleSize);
        
        // Rotate handle
        const rotateX = shape.x;
        const rotateY = shape.y - shape.radius - 20;
        ctx.beginPath();
        ctx.arc(rotateX, rotateY, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Bounding circle for selection
        ctx.strokeStyle = '#00ff00';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    } else if (shape.type === 'line') {
        // End point handles
        ctx.fillRect(shape.x - handleSize / 2, shape.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(shape.x - handleSize / 2, shape.y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(shape.x2 - handleSize / 2, shape.y2 - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(shape.x2 - handleSize / 2, shape.y2 - handleSize / 2, handleSize, handleSize);
    } else if (shape.type === 'text' || shape.type === 'pen') {
        // Just draw bounding box
        const bounds = getShapeBounds(shape);
        ctx.strokeStyle = '#00ff00';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);
    }
}

// Get shape bounds
function getShapeBounds(shape) {
    if (shape.type === 'rectangle') {
        return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    } else if (shape.type === 'circle') {
        return {
            x: shape.x - shape.radius,
            y: shape.y - shape.radius,
            width: shape.radius * 2,
            height: shape.radius * 2
        };
    } else if (shape.type === 'line') {
        return {
            x: Math.min(shape.x, shape.x2),
            y: Math.min(shape.y, shape.y2),
            width: Math.abs(shape.x2 - shape.x),
            height: Math.abs(shape.y2 - shape.y)
        };
    } else if (shape.type === 'text') {
        ctx.font = `${shape.fontSize}px Arial`;
        const metrics = ctx.measureText(shape.text);
        return {
            x: shape.x,
            y: shape.y - shape.fontSize,
            width: metrics.width,
            height: shape.fontSize
        };
    } else if (shape.type === 'pen') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let point of shape.points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
}

// Delete selected shape
function deleteSelected() {
    if (selectedShape) {
        shapes = shapes.filter(s => s !== selectedShape);
        selectedShape = null;
        redraw();
    }
}

// Clear canvas
function clearCanvas() {
    if (confirm('Clear all annotations?')) {
        shapes = [];
        selectedShape = null;
        redraw();
    }
}

// Undo
function undo() {
    if (shapes.length > 0) {
        shapes.pop();
        selectedShape = null;
        redraw();
    }
}

// Save redline
async function saveRedline() {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        // Create a temporary canvas to combine both layers
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageCanvas.width;
        tempCanvas.height = imageCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw image first
        tempCtx.drawImage(imageCanvas, 0, 0);
        
        // Draw all shapes
        const savedSelected = selectedShape;
        selectedShape = null; // Don't show selection in saved image
        
        for (let shape of shapes) {
            drawShapeOnContext(tempCtx, shape);
        }
        
        selectedShape = savedSelected;
        
        // Convert to blob
        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64data = reader.result.split(',')[1];
            
            // Upload file
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileName,
                    fileContent: base64data,
                    projectId: projectId,
                    type: 'redlines'
                })
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const result = await response.json();
            
            // Update project with new redline
            const projectResponse = await fetch(`/api/projects?id=${projectId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!projectResponse.ok) throw new Error('Failed to fetch project');
            
            const projectData = await projectResponse.json();
            const project = projectData.projects[0];
            
            const redlines = project.redlines || [];
            redlines.push(result);
            
            const updateResponse = await fetch('/api/projects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: projectId,
                    redlines: redlines
                })
            });
            
            if (!updateResponse.ok) throw new Error('Failed to update project');
            
            alert('Redline saved successfully!');
            window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
        };
        
        reader.readAsDataURL(blob);
        
    } catch (error) {
        console.error('Error saving redline:', error);
        alert('Failed to save redline: ' + error.message);
        event.target.disabled = false;
        event.target.textContent = '💾 Save Redline';
    }
}

// Draw shape on a specific context (for saving)
function drawShapeOnContext(ctx, shape) {
    ctx.save();
    
    if (shape.type === 'pen') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (shape.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            ctx.stroke();
        }
    } else if (shape.type === 'line') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
    } else if (shape.type === 'rectangle') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.strokeWidth;
        
        if (shape.rotation) {
            ctx.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
            ctx.rotate(shape.rotation);
            ctx.strokeRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
        } else {
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
    } else if (shape.type === 'circle') {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
    } else if (shape.type === 'text') {
        ctx.fillStyle = shape.color;
        ctx.font = `${shape.fontSize}px Arial`;
        ctx.fillText(shape.text, shape.x, shape.y);
    }
    
    ctx.restore();
}

// Go back
function goBack() {
    if (shapes.length > 0) {
        if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
            window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
        }
    } else {
        window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
    }
}

// Expose functions to window for onclick handlers
window.selectTool = selectTool;
window.clearCanvas = clearCanvas;
window.undo = undo;
window.undoLast = undo; // Alias
window.saveRedline = saveRedline;
window.goBack = goBack;

// Initialize on load
window.addEventListener('DOMContentLoaded', init);

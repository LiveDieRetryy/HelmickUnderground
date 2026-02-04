// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('pdf');
const projectId = urlParams.get('project_id');
const customerId = urlParams.get('customer_id');
const filename = urlParams.get('filename');

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDocument = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!pdfUrl || !projectId || !customerId || !filename) {
        showError('Missing required parameters');
        return;
    }

    document.getElementById('filename').textContent = `📄 ${filename}`;

    try {
        await loadPDF();
    } catch (error) {
        console.error('Error loading PDF:', error);
        showError('Failed to load PDF: ' + error.message);
    }
});

// Load PDF and render thumbnails
async function loadPDF() {
    try {
        // Convert GitHub URL to raw content URL if needed
        let pdfLoadUrl = pdfUrl;
        if (pdfUrl.includes('github.com') && !pdfUrl.includes('raw.githubusercontent.com')) {
            pdfLoadUrl = pdfUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }

        // Load the PDF
        const loadingTask = pdfjsLib.getDocument(pdfLoadUrl);
        pdfDocument = await loadingTask.promise;

        const numPages = pdfDocument.numPages;
        console.log(`PDF loaded: ${numPages} pages`);

        // Hide loading
        document.getElementById('loading').style.display = 'none';

        // Render all pages
        const pagesGrid = document.getElementById('pagesGrid');
        pagesGrid.innerHTML = '';

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            await renderPageThumbnail(pageNum);
        }

    } catch (error) {
        console.error('Error in loadPDF:', error);
        throw error;
    }
}

// Render a single page thumbnail
async function renderPageThumbnail(pageNum) {
    try {
        const page = await pdfDocument.getPage(pageNum);
        
        // Calculate scale for thumbnail
        const viewport = page.getViewport({ scale: 1.0 });
        const thumbnailWidth = 250; // Match grid size
        const scale = thumbnailWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'page-canvas';
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');

        // Render page
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };

        await page.render(renderContext).promise;

        // Create page card
        const pageCard = document.createElement('div');
        pageCard.className = 'page-card';
        pageCard.onclick = () => selectPage(pageNum);

        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${pageNum}`;

        pageCard.appendChild(canvas);
        pageCard.appendChild(pageNumber);

        document.getElementById('pagesGrid').appendChild(pageCard);

    } catch (error) {
        console.error(`Error rendering page ${pageNum}:`, error);
    }
}

// Select a page and convert it to image for redlining
async function selectPage(pageNum) {
    try {
        // Show loading
        const pagesGrid = document.getElementById('pagesGrid');
        pagesGrid.style.opacity = '0.5';
        pagesGrid.style.pointerEvents = 'none';

        const page = await pdfDocument.getPage(pageNum);

        // Render at high resolution for redlining
        const viewport = page.getViewport({ scale: 2.0 });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render page
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Convert to PNG data URL
        const imageDataUrl = canvas.toDataURL('image/png');

        // Generate filename for this page
        const baseFilename = filename.replace('.pdf', '');
        const pageFilename = `${baseFilename}_page${pageNum}.png`;

        // Navigate to redline editor with the page image
        const editorUrl = `redline-editor.html?image=${encodeURIComponent(imageDataUrl)}&filename=${encodeURIComponent(pageFilename)}&project_id=${projectId}&customer_id=${customerId}&fromPdf=true&pageNumber=${pageNum}`;
        window.location.href = editorUrl;

    } catch (error) {
        console.error('Error selecting page:', error);
        showError('Failed to load page: ' + error.message);
        
        const pagesGrid = document.getElementById('pagesGrid');
        pagesGrid.style.opacity = '1';
        pagesGrid.style.pointerEvents = 'auto';
    }
}

// Show error message
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Go back to project details
function goBack() {
    window.location.href = `project-details.html?id=${projectId}&customer_id=${customerId}`;
}

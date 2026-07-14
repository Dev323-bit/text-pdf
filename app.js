// Aura Text to PDF — Core Application Logic

// Destructure jsPDF from global window object (loaded via CDN)
const { jsPDF } = window.jspdf;

// App State
let selectedAlign = 'left';
let selectedColorHex = '#000000';
const colorNames = {
    '#000000': 'Classic Black',
    '#334155': 'Charcoal Gray',
    '#1e3a8a': 'Navy Blue',
    '#064e3b': 'Forest Green',
    '#7f1d1d': 'Deep Red'
};

// DOM Elements
const textInput = document.getElementById('text-input');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const lineCountEl = document.getElementById('line-count');
const clearBtn = document.getElementById('clear-btn');

// Toolbar Elements
const fontFamilySelect = document.getElementById('font-family');
const fontSizeSelect = document.getElementById('font-size');
const alignBtns = document.querySelectorAll('.align-btn');

// Page Settings Elements
const pageSizeSelect = document.getElementById('page-size');
const pageOrientationSelect = document.getElementById('page-orientation');
const pageMarginsSelect = document.getElementById('page-margins');
const lineSpacingSelect = document.getElementById('line-spacing');

// Color Picker Elements
const colorPresetsContainer = document.getElementById('color-presets');
const colorPresetBtns = document.querySelectorAll('.color-preset');
const selectedColorNameEl = document.getElementById('selected-color-name');

// Header/Footer Elements
const enableHeaderCheckbox = document.getElementById('enable-header');
const headerInputContainer = document.getElementById('header-input-container');
const headerTextInput = document.getElementById('header-text');
const enablePageNumbersCheckbox = document.getElementById('enable-page-numbers');
const enableDateCheckbox = document.getElementById('enable-date');

// Export Elements
const pdfFilenameInput = document.getElementById('pdf-filename');
const downloadBtn = document.getElementById('download-btn');
const toastContainer = document.getElementById('toast-container');

// Safe Lucide Icon initialization helper
function initIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        try {
            lucide.createIcons();
        } catch (e) {
            console.warn("Failed to render Lucide icons:", e);
        }
    }
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initIcons();
    setupEventListeners();
    updateTextStats();
});

// Event Listeners Configuration
function setupEventListeners() {
    // Real-time Text Stat Counters
    textInput.addEventListener('input', updateTextStats);

    // Clear and Reset Text
    clearBtn.addEventListener('click', handleClearText);

    // Text Alignment selection
    alignBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            alignBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAlign = btn.dataset.align;
            showToast('Alignment Changed', `Text alignment set to ${selectedAlign}.`, 'info');
        });
    });

    // Color Preset selection
    colorPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedColorHex = btn.dataset.color;
            selectedColorNameEl.textContent = colorNames[selectedColorHex] || selectedColorHex;

            // Subtle feedback
            showToast('Color Selected', `Text color set to ${colorNames[selectedColorHex]}.`, 'info');
        });
    });

    // Toggle Header Input fields
    enableHeaderCheckbox.addEventListener('change', () => {
        if (enableHeaderCheckbox.checked) {
            headerInputContainer.classList.add('show');
        } else {
            headerInputContainer.classList.remove('show');
        }
    });

    // Main Export Event
    downloadBtn.addEventListener('click', generatePDF);
}

// Update text counters
function updateTextStats() {
    const text = textInput.value;

    // Character count
    const charCount = text.length;

    // Word count (split by whitespaces)
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

    // Line count (split by newlines)
    const lines = text === '' ? 0 : text.split('\n').length;

    wordCountEl.textContent = words.toLocaleString();
    charCountEl.textContent = charCount.toLocaleString();
    lineCountEl.textContent = lines.toLocaleString();
}

// Reset textarea content
function handleClearText() {
    if (textInput.value === '') return;

    textInput.value = '';
    updateTextStats();
    showToast('Cleared', 'Editor cleared successfully.', 'info');
}

// Convert Hex string color to RGB object
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
}

// Core PDF Generation Pipeline
async function generatePDF() {
    const text = textInput.value.trim();

    if (text === '') {
        showToast('Empty Text', 'Cannot generate an empty PDF. Please type or paste some content.', 'warning');
        return;
    }

    try {
        showToast('Processing', 'Compiling document layout...', 'info');

        // Disable download button while generating
        downloadBtn.disabled = true;

        // Fetch values
        const orientation = pageOrientationSelect.value;
        const format = pageSizeSelect.value;
        const marginMm = parseFloat(pageMarginsSelect.value);
        const fontFamily = fontFamilySelect.value;
        const fontSizePt = parseInt(fontSizeSelect.value);
        const lineSpacing = parseFloat(lineSpacingSelect.value);

        // Create document instance
        // Unit 'mm' is standard for precise layout sizing
        const doc = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: format
        });

        // Dimensions of the current page format
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Max wrapping width for text lines
        const maxLineWidthMm = pageWidth - (marginMm * 2);

        // Set body text properties
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(fontSizePt);
        const rgb = hexToRgb(selectedColorHex);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);

        // Standard point to millimeter ratio
        const PT_TO_MM = 0.352778;
        const fontHeightMm = fontSizePt * PT_TO_MM;
        const lineHeightMm = fontHeightMm * lineSpacing;

        // Boundaries
        const topMarginLimit = marginMm;
        const bottomMarginLimit = pageHeight - marginMm;

        // Split text by newlines into paragraphs to preserve layout intent
        const paragraphs = textInput.value.split('\n');

        // Position variables (baseline-based)
        let yPosition = topMarginLimit + fontHeightMm;

        for (let p = 0; p < paragraphs.length; p++) {
            const paragraphText = paragraphs[p];

            // Empty line spacing
            if (paragraphText.trim() === '') {
                yPosition += lineHeightMm * 0.6;
                continue;
            }

            // Split current paragraph into wrapped lines
            const lines = doc.splitTextToSize(paragraphText, maxLineWidthMm);

            for (let l = 0; l < lines.length; l++) {
                const lineText = lines[l];

                // Page Overflow boundary check
                if (yPosition > bottomMarginLimit) {
                    doc.addPage();

                    // Re-apply styles on new page
                    doc.setFont(fontFamily, 'normal');
                    doc.setFontSize(fontSizePt);
                    doc.setTextColor(rgb.r, rgb.g, rgb.b);

                    // Reset Y coordinate to page top bounds
                    yPosition = topMarginLimit + fontHeightMm;
                }

                // Compute x coordinates according to alignment option
                let xPosition = marginMm;
                let alignOption = 'left';

                if (selectedAlign === 'center') {
                    xPosition = marginMm + (maxLineWidthMm / 2);
                    alignOption = 'center';
                } else if (selectedAlign === 'right') {
                    xPosition = pageWidth - marginMm;
                    alignOption = 'right';
                } else if (selectedAlign === 'justify') {
                    // In typography, the last line of a justified paragraph is left-aligned
                    if (l === lines.length - 1) {
                        xPosition = marginMm;
                        alignOption = 'left';
                    } else {
                        xPosition = marginMm;
                        alignOption = 'justify';
                    }
                }

                // Render line
                doc.text(lineText, xPosition, yPosition, {
                    align: alignOption,
                    maxWidth: maxLineWidthMm
                });

                // Advance to next line spacing
                yPosition += lineHeightMm;
            }

            // Standard paragraph break gap
            if (p < paragraphs.length - 1) {
                yPosition += lineHeightMm * 0.35;
            }
        }

        // --- SECOND PASS: Overlays Headers, Footers, and Dates on all pages ---
        const totalPages = doc.internal.getNumberOfPages();
        const headerY = marginMm * 0.6;
        const footerY = pageHeight - (marginMm * 0.6);
        const dateStampText = new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);

            // Set header/footer small font styling
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate 500 gray color

            // 1. Render Header Title (Left Aligned)
            const hasHeader = enableHeaderCheckbox.checked && headerTextInput.value.trim() !== '';
            if (hasHeader) {
                const headerText = headerTextInput.value.trim().toUpperCase();
                doc.text(headerText, marginMm, headerY, { align: 'left' });
            }

            // 2. Render Export Date Stamp (Right Aligned, shares line with header)
            if (enableDateCheckbox.checked) {
                doc.text(dateStampText, pageWidth - marginMm, headerY, { align: 'right' });
            }

            // Header Horizontal Divider Line
            if (hasHeader || enableDateCheckbox.checked) {
                doc.setDrawColor(226, 232, 240); // Light border color
                doc.setLineWidth(0.12);
                doc.line(marginMm, headerY + 2.2, pageWidth - marginMm, headerY + 2.2);
            }

            // 3. Render Page Numbers (Centered Footer)
            if (enablePageNumbersCheckbox.checked) {
                // Footer Divider Line
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.12);
                doc.line(marginMm, footerY - 4, pageWidth - marginMm, footerY - 4);

                const pageNumText = `Page ${i} of ${totalPages}`;
                doc.text(pageNumText, pageWidth / 2, footerY, { align: 'center' });
            }
        }

        // File download save operation
        let filename = pdfFilenameInput.value.trim();
        if (filename === '') {
            filename = 'aura-text-export';
        }
        // Remove trailing .pdf if entered manually to avoid double extensions
        if (filename.toLowerCase().endsWith('.pdf')) {
            filename = filename.slice(0, -4);
        }

        doc.save(`${filename}.pdf`);
        showToast('Success', 'PDF compiled and download started!', 'success');

    } catch (error) {
        console.error("PDF generation failed:", error);
        showToast('Export Error', 'An error occurred while compiling your PDF.', 'error');
    } finally {
        downloadBtn.disabled = false;
    }
}

// Toast Notifications System Helper
function showToast(title, message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';
    if (type === 'warning') icon = 'alert-circle';

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
        </div>
        <div class="toast-content">
            <span class="toast-title">${title}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Bind Lucide icon instance
    initIcons();

    // Small slide-in delay
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove toast card after 4.2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4200);
}

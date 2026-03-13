// Editor Script
let editor;
let previewFrame = document.getElementById('preview-frame');
let targetInfo = document.getElementById('target-info');
let isUpdatingFromCode = false;
let isUpdatingFromPreview = false;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('code-editor'), {
        value: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Helvetica Neue', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 80vh; background: #fff; margin:0; }
        .card { padding: 40px; border-radius: 20px; background: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.1); text-align: center; max-width: 400px; border: 1px solid #eee; position: relative; }
        h1 { color: #333; margin-top: 0; }
        p { color: #666; line-height: 1.6; }
        .btn { display: inline-block; padding: 12px 30px; background: #58a6ff; color: #fff; border-radius: 30px; text-decoration: none; font-weight: 600; margin-top: 20px; transition: 0.3s; }
        .btn:hover { transform: scale(1.05); }
        img { max-width: 100%; border-radius: 10px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80" alt="Sample">
        <h1>Welcome Designer</h1>
        <p>This is your live canvas. You can edit the code on the left or interact with elements here.</p>
        <a href="#" class="btn">Get Started</a>
    </div>
</body>
</html>`,
        language: 'html',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
        lineHeight: 1.6,
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        roundedSelection: true,
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true
    });

    // Initial load
    updatePreview();

    // Listen for changes
    editor.onDidChangeModelContent(() => {
        if (!isUpdatingFromPreview) {
            isUpdatingFromCode = true;
            updatePreview();
            isUpdatingFromCode = false;
        }
    });

    // Initialize Icons
    lucide.createIcons();
});

function updatePreview() {
    const html = editor.getValue();
    const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Inject visual editing script after load
    setTimeout(() => injectEditingTools(), 100);
}

function injectEditingTools() {
    const doc = previewFrame.contentDocument;
    if (!doc) return;

    // Inject CSS for handles
    const style = doc.createElement('style');
    style.id = 'editor-styles';
    style.textContent = `
        .v-selected { outline: 2px solid #58a6ff !important; outline-offset: 2px !important; }
        .v-hover { outline: 1px dashed rgba(88, 166, 255, 0.5) !important; outline-offset: 2px !important; }
        [contenteditable]:focus { outline: none !important; }
    `;
    doc.head.appendChild(style);

    // Click to select
    doc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectElement(e.target);
    });

    // Hover effect
    doc.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('v-selected')) return;
        e.target.classList.add('v-hover');
    });
    doc.addEventListener('mouseout', (e) => {
        e.target.classList.remove('v-hover');
    });

    // Drag and resize logic
    let isDragging = false;
    let currentElement = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    doc.addEventListener('mousedown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isModifierDown = e.altKey || (isMac && e.metaKey);
        if (!isModifierDown) return; 
        currentElement = e.target;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = currentElement.getBoundingClientRect();
        startLeft = currentElement.offsetLeft;
        startTop = currentElement.offsetTop;
        startWidth = rect.width;
        startHeight = rect.height;

        currentElement.style.position = 'relative';
        currentElement.style.zIndex = '1000';
    });

    doc.addEventListener('mousemove', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isModifierDown = e.altKey || (isMac && e.metaKey);
        
        // Update cursor based on modifier keys
        if (isModifierDown && !isDragging) {
            doc.body.style.cursor = e.shiftKey ? 'nwse-resize' : 'grab';
        } else if (!isDragging) {
            doc.body.style.cursor = 'default';
        }

        if (!isDragging || !currentElement) return;

        doc.body.style.cursor = e.shiftKey ? 'nwse-resize' : 'grabbing';
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (e.shiftKey) { // Resize with shift
            currentElement.style.width = (startWidth + dx) + 'px';
            currentElement.style.height = (startHeight + dy) + 'px';
        } else { // Move
            currentElement.style.left = (startLeft + dx) + 'px';
            currentElement.style.top = (startTop + dy) + 'px';
        }
        
        syncChangesToEditor();
    });

    doc.addEventListener('mouseup', () => {
        isDragging = false;
        currentElement = null;
        doc.body.style.cursor = 'default';
    });

    // Enable content editing
    doc.querySelectorAll('h1, h2, h3, p, span, a, div').forEach(el => {
        if (el.children.length === 0 || (el.children.length > 0 && el.innerText.trim().length > 0)) {
            el.contentEditable = 'true';
            el.addEventListener('input', () => syncChangesToEditor());
        }
    });

    // Image Upload (Drag & Drop)
    doc.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'IMG') {
            e.target.style.opacity = '0.5';
        }
    });

    doc.addEventListener('dragleave', (e) => {
        if (e.target.tagName === 'IMG') {
            e.target.style.opacity = '1';
        }
    });

    doc.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0 && e.target.tagName === 'IMG') {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                e.target.src = event.target.result;
                e.target.style.opacity = '1';
                syncChangesToEditor();
            };
            reader.readAsDataURL(file);
        }
    });
}

function selectElement(el) {
    const doc = previewFrame.contentDocument;
    doc.querySelectorAll('.v-selected').forEach(x => x.classList.remove('v-selected'));
    el.classList.add('v-selected');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? 'Cmd' : 'Alt';
    const optKey = 'Opt';
    targetInfo.innerText = `Selected: <${el.tagName.toLowerCase()}> | Use ${cmdKey}/${optKey}+Drag to move, Shift+${cmdKey}/${optKey}+Drag to resize`;
}

function syncChangesToEditor() {
    if (isUpdatingFromCode) return;
    isUpdatingFromPreview = true;
    
    const doc = previewFrame.contentDocument.cloneNode(true);
    // Cleanup temporary classes/styles before syncing back
    doc.querySelectorAll('.v-selected, .v-hover').forEach(el => {
        el.classList.remove('v-selected', 'v-hover');
        if (el.classList.length === 0) el.removeAttribute('class');
    });
    const editorStyles = doc.getElementById('editor-styles');
    if (editorStyles) editorStyles.remove();
    
    doc.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

    const cleanHtml = doc.documentElement.outerHTML;
    editor.setValue(cleanHtml);
    isUpdatingFromPreview = false;
}

// Resizer logic
const resizer = document.getElementById('resizer');
const editorPane = document.getElementById('editor-pane');
let isResizing = false;

resizer.addEventListener('mousedown', () => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
});

window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const offset = e.clientX;
    const width = (offset / window.innerWidth) * 100;
    if (width > 10 && width < 90) {
        editorPane.style.width = width + '%';
    }
});

window.addEventListener('mouseup', () => {
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = 'default';
});

// Toolbar Buttons
document.getElementById('copy-btn').addEventListener('click', () => {
    const html = editor.getValue();
    navigator.clipboard.writeText(html).then(() => {
        const btn = document.getElementById('copy-btn');
        const icon = btn.querySelector('i');
        const span = btn.querySelector('span');
        const originalText = span.innerText;
        const originalIcon = icon.getAttribute('data-lucide');
        
        span.innerText = 'Copied!';
        btn.style.borderColor = '#238636';
        btn.style.background = 'rgba(35, 134, 54, 0.1)';
        
        setTimeout(() => {
            span.innerText = originalText;
            btn.style.borderColor = '';
            btn.style.background = '';
        }, 2000);
    });
});

document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            // If an element is selected in the preview and it's an image, update it
            const doc = previewFrame.contentDocument;
            const selected = doc.querySelector('.v-selected');
            if (selected && selected.tagName === 'IMG') {
                selected.src = event.target.result;
                syncChangesToEditor();
            } else {
                alert("Please select an image in the preview first to replace its source.");
            }
        };
        reader.readAsDataURL(file);
    }
});

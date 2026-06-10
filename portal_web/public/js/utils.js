// Format basic Markdown into HTML
export function formatMarkdown(text) {
    if (!text) return '';
    
    let formatted = text;

    // Code blocks: ```content```
    formatted = formatted.replace(/```(?:\w+\n)?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code: `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (excluding bullet spaces/line starts)
    formatted = formatted.replace(/(?<!\*)\*([^* \n][^*]*?[^* \n]?)\*(?!\*)/g, '<em>$1</em>');
    formatted = formatted.replace(/(?<!_)_([^_ \n][^_]*?[^_ \n]?)_(?!_)/g, '<em>$1</em>');

    // Headers
    formatted = formatted.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Lists: Unordered and Ordered line-by-line
    const lines = formatted.split('\n');
    let inList = false;
    let inOrderedList = false;
    
    const processedLines = lines.map(line => {
        let trimmed = line.trim();
        
        // Skip code blocks and special divs from processing
        if (line.includes('<pre>') || line.includes('<code>') || line.includes('<pre><code>') || line.includes('</pre>') || line.includes('</code>') || line.includes('<div') || line.includes('</div>')) {
            return line;
        }

        // Unordered list item: * or -
        const ulMatch = line.match(/^(\s*)[*\-+]\s+(.*)$/);
        if (ulMatch) {
            let prefix = '';
            if (inOrderedList) {
                prefix += '</ol>';
                inOrderedList = false;
            }
            if (!inList) {
                prefix += '<ul>';
                inList = true;
            }
            return prefix + `<li>${ulMatch[2]}</li>`;
        }

        // Ordered list item: 1.
        const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
        if (olMatch) {
            let prefix = '';
            if (inList) {
                prefix += '</ul>';
                inList = false;
            }
            if (!inOrderedList) {
                prefix += '<ol>';
                inOrderedList = true;
            }
            return prefix + `<li>${olMatch[2]}</li>`;
        }

        // Normal line
        let prefix = '';
        if (inList) {
            prefix += '</ul>';
            inList = false;
        }
        if (inOrderedList) {
            prefix += '</ol>';
            inOrderedList = false;
        }

        if (trimmed === '' || trimmed.startsWith('<h')) {
            return prefix + line;
        }
        
        return prefix + line + '<br>';
    });

    if (inList) processedLines.push('</ul>');
    if (inOrderedList) processedLines.push('</ol>');

    return processedLines.join('\n');
}

// Helper to append chat messages
export function appendMessage(container, sender, htmlContent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = sender === 'assistant' ? '🧠' : '👤';
    
    messageDiv.innerHTML = `
        <div class="avatar">${avatar}</div>
        <div class="message-content">
            ${htmlContent}
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    return messageDiv;
}

// Helper to append lines to Console drawer
export function appendConsoleLine(container, text, type = 'normal') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
}

// Logs functionality
async function refreshLogs() {
    try {
        const response = await fetch('/logs_raw');
        const logsText = await response.text();
        const logsContent = document.getElementById('logsContent');

        if (logsText.trim()) {
            const lines = logsText.split('\n');
            logsContent.innerHTML = lines
                .map(line => `<div class="log-line">${escapeHtml(line)}</div>`)
                .join('');

            logsContent.scrollTop = logsContent.scrollHeight;
        } else {
            logsContent.innerHTML = '<div class="log-empty">No logs yet...</div>';
        }
    } catch (error) {
        console.error('Error fetching logs:', error);
        document.getElementById('logsContent').innerHTML =
            '<div class="log-empty">Error loading logs</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-refresh logs every 15 seconds
setInterval(refreshLogs, 15000);

// Load logs on page load
refreshLogs();
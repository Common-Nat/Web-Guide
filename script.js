// Configuration - REPLACE WITH YOUR GOOGLE SHEET URL
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQZzopZ9wRk4Poq4-7gccWana-sk3poO4NS0wZ-3tmBtRxnQ3ujkZjFBdQp3T4fkBo58mqM8cAVjj-k/pub?gid=0&single=true&output=csv';

// DOM Elements
const dashboard = document.getElementById('dashboard');
const searchInput = document.getElementById('search');
const themeToggle = document.querySelector('.theme-toggle');
const lastUpdatedSpan = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-btn');

// State
let linksData = [];
const savedTheme = localStorage.getItem('dashboard-theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

// Fetch data from Google Sheets
async function fetchLinks() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const { data } = parseCSV(csvText);
        
        // Remove header row
        if (data.length > 0) {
            linksData = data.slice(1).map(row => ({
                name: row[0] || '',
                url: row[1] || '',
                category: row[2] || 'Uncategorized',
                icon: row[3] || 'fa-link',
                color: row[4] || ''
            }));
        }
        
        renderDashboard();
        lastUpdatedSpan.textContent = new Date().toLocaleString();
        localStorage.setItem('dashboard-last-updated', new Date().toLocaleString());
        localStorage.setItem('dashboard-data', JSON.stringify(linksData));
    } catch (error) {
        console.error('Error fetching data:', error);
        dashboard.innerHTML = `
            <div class="error">
                <p>Failed to load data from Google Sheets. Check your connection or Sheet URL.</p>
                <button id="retry-btn">Retry</button>
            </div>
        `;
        document.getElementById('retry-btn').addEventListener('click', fetchLinks);
        
        // Try to load cached data
        const cachedData = localStorage.getItem('dashboard-data');
        if (cachedData) {
            linksData = JSON.parse(cachedData);
            renderDashboard();
            const lastUpdated = localStorage.getItem('dashboard-last-updated') || 'unknown';
            lastUpdatedSpan.textContent = `${lastUpdated} (cached)`;
        }
    }
}

// Parse CSV text
function parseCSV(text) {
    const lines = text.split('\n');
    const data = lines.map(line => line.split(',').map(item => item.trim()));
    return { data };
}

// Render the dashboard
function renderDashboard(searchTerm = '') {
    // Group links by category
    const categories = {};
    
    linksData.forEach(link => {
        // Skip if it doesn't match search
        if (searchTerm && !link.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return;
        }
        
        if (!categories[link.category]) {
            categories[link.category] = [];
        }
        categories[link.category].push(link);
    });
    
    // Generate HTML
    let html = '';
    
    if (Object.keys(categories).length === 0) {
        html = '<div class="no-results">No links found. Try a different search term.</div>';
    } else {
        for (const category in categories) {
            const links = categories[category];
            html += `
                <div class="category">
                    <h2 class="category-header">
                        <i class="fas fa-folder"></i> ${category}
                    </h2>
                    <div class="links-grid">
                        ${links.map(link => `
                            <div class="link-card">
                                <i class="fas ${link.icon}" style="color: ${link.color};"></i>
                                <a href="${link.url}" target="_blank" rel="noopener">${link.name}</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    dashboard.innerHTML = html;
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    renderDashboard(e.target.value);
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('dashboard-theme', isDark ? 'dark' : 'light');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

refreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    dashboard.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Refreshing data from Google Sheets...</p>
        </div>
    `;
    fetchLinks();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const lastUpdated = localStorage.getItem('dashboard-last-updated');
    if (lastUpdated) {
        lastUpdatedSpan.textContent = lastUpdated;
    }
    
    // Try to load cached data first
    const cachedData = localStorage.getItem('dashboard-data');
    if (cachedData) {
        linksData = JSON.parse(cachedData);
        renderDashboard();
    }
    
    // Then fetch latest data
    fetchLinks();
});

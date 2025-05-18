// Configuration - REPLACE WITH YOUR GOOGLE SHEET URL
const SHEET_URL = 'YOUR_PUBLISHED_GOOGLE_SHEET_CSV_URL_HERE';
const CACHE_VERSION = 'dashboard-v1';
const CACHE_NAME = `${CACHE_VERSION}-${new Date().toISOString().split('T')[0]}`;

// DOM Elements
const dashboard = document.getElementById('dashboard');
const searchInput = document.getElementById('search');
const themeToggle = document.querySelector('.theme-toggle');
const viewToggle = document.getElementById('view-toggle');
const lastUpdatedSpan = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-btn');
const addButton = document.getElementById('add-button');
const quickAddContainer = document.getElementById('quick-add-container');
const newLinkForm = {
    name: document.getElementById('new-link-name'),
    url: document.getElementById('new-link-url'),
    category: document.getElementById('new-link-category'),
    icon: document.getElementById('new-link-icon'),
    color: document.getElementById('new-link-color')
};
const categorySuggestions = document.getElementById('category-suggestions');
const saveAddBtn = document.getElementById('save-add');
const cancelAddBtn = document.getElementById('cancel-add');
const connectionStatus = document.getElementById('connection-status');
const connectionIcon = document.querySelector('.connection-status i');

// State Management
let linksData = [];
let favorites = JSON.parse(localStorage.getItem('dashboard-favorites') || '[]');
let categories = [];
let isOnline = navigator.onLine;
let localLinks = JSON.parse(localStorage.getItem('dashboard-local-links') || '[]');

// Settings & Preferences
const settings = {
    theme: localStorage.getItem('dashboard-theme') || 'light',
    viewMode: localStorage.getItem('dashboard-view-mode') || 'expanded'
};

// Initialize Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered: ', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Apply Stored Settings
function applySettings() {
    // Apply theme
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    // Apply view mode
    if (settings.viewMode === 'compact') {
        document.body.classList.add('compact-view');
        viewToggle.innerHTML = '<i class="fas fa-table-cells-large"></i>';
    } else {
        document.body.classList.remove('compact-view');
        viewToggle.innerHTML = '<i class="fas fa-table-cells"></i>';
    }
}

// Toast Notification System
const toast = {
    show: function(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        const toastElement = document.createElement('div');
        toastElement.className = `toast ${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';
        if (type === 'warning') iconClass = 'fa-exclamation-triangle';
        
        toastElement.innerHTML = `
            <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
            <div class="toast-content">${message}</div>
            <div class="toast-close"><i class="fas fa-times"></i></div>
        `;
        
        toastContainer.appendChild(toastElement);
        
        // Close button event
        const closeBtn = toastElement.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toastElement.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                toastContainer.removeChild(toastElement);
            }, 300);
        });
        
        // Auto close
        setTimeout(() => {
            if (toastElement.parentNode === toastContainer) {
                toastElement.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toastElement.parentNode === toastContainer) {
                        toastContainer.removeChild(toastElement);
                    }
                }, 300);
            }
        }, duration);
    }
};

// Network Status Management
function updateOnlineStatus() {
    isOnline = navigator.onLine;
    
    if (isOnline) {
        connectionStatus.textContent = 'Online';
        connectionStatus.parentElement.classList.remove('offline');
        connectionStatus.parentElement.classList.add('online');
        connectionIcon.className = 'fas fa-wifi';
    } else {
        connectionStatus.textContent = 'Offline';
        connectionStatus.parentElement.classList.remove('online');
        connectionStatus.parentElement.classList.add('offline');
        connectionIcon.className = 'fas fa-wifi-slash';
        toast.show('You are offline. Using cached data.', 'warning');
    }
}

window.addEventListener('online', () => {
    updateOnlineStatus();
    fetchLinks();
    toast.show('Connection restored. Data refreshed.', 'success');
});

window.addEventListener('offline', () => {
    updateOnlineStatus();
    toast.show('You are offline. Using cached data.', 'warning');
});

// Fetch links from Google Sheets
async function fetchLinks() {
    dashboard.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your links...</p>
        </div>
    `;
    
    try {
        if (!isOnline) {
            throw new Error('You are offline');
        }
        
        const response = await fetch(SHEET_URL);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const { data } = parseCSV(csvText);
        
        // Remove header row
        if (data.length > 0) {
            linksData = data.slice(1)
                .filter(row => row.length >= 3 && row[0] && row[1]) // Ensure valid data
                .map(row => ({
                    name: row[0] || '',
                    url: row[1] || '',
                    category: row[2] || 'Uncategorized',
                    icon: row[3] || 'fa-link',
                    color: row[4] || '',
                    isFavorite: favorites.includes(row[1])
                }));
        }
        
        // Extract unique categories for suggestions
        categories = [...new Set(linksData.map(link => link.category))];
        
        // Save to cache
        localStorage.setItem('dashboard-data', JSON.stringify(linksData));
        localStorage.setItem('dashboard-categories', JSON.stringify(categories));
        localStorage.setItem('dashboard-last-updated', new Date().toLocaleString());
        
        lastUpdatedSpan.textContent = new Date().toLocaleString();
        
        // Combine with local links
        linksData = [...linksData, ...localLinks];
        
        renderDashboard();
        toast.show('Dashboard updated successfully!', 'success');
    } catch (error) {
        console.error('Error fetching data:', error);
        
        dashboard.innerHTML = `
            <div class="error-container">
                <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
                <h3>Oops! Couldn't load data</h3>
                <p>${error.message}</p>
                <button id="retry-btn" class="retry-button">Retry</button>
            </div>
        `;
        
        document.getElementById('retry-btn').addEventListener('click', fetchLinks);
        toast.show('Failed to load data. Check your connection.', 'error');
        
        // Try to load cached data
        const cachedData = localStorage.getItem('dashboard-data');
        if (cachedData) {
            linksData = JSON.parse(cachedData);
            
            // Merge with local links and mark favorites
            linksData = [...linksData, ...localLinks].map(link => ({
                ...link,
                isFavorite: favorites.includes(link.url)
            }));
            
            categories = JSON.parse(localStorage.getItem('dashboard-categories') || '[]');
            
            const lastUpdated = localStorage.getItem('dashboard-last-updated') || 'unknown';
            lastUpdatedSpan.textContent = `${lastUpdated} (cached)`;
            
            renderDashboard();
            toast.show('Loaded from cache. Some data may be outdated.', 'info');
        }
    }
}

// Parse CSV text
function parseCSV(text) {
    const lines = text.split('\n');
    const data = lines.map(line => {
        // Handle CSV properly with quote escaping
        const row = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        row.push(currentValue.trim());
        return row;
    });
    
    return { data };
}

// Render the dashboard
function renderDashboard(searchTerm = '') {
    // Group links by category
    const categoryGroups = {};
    let favoritesLinks = [];
    
    // First collect favorites
    linksData.forEach(link => {
        if (link.isFavorite) {
            favoritesLinks.push(link);
        }
    });
    
    // Then group by category
    linksData.forEach(link => {
        // Skip if it doesn't match search
        if (searchTerm && !matchesSearch(link, searchTerm)) {
            return;
        }
        
        if (!categoryGroups[link.category]) {
            categoryGroups[link.category] = [];
        }
        
        categoryGroups[link.category].push(link);
    });
    
    // Generate HTML
    let html = '';
    
    // Add favorites category if we have favorites
    if (favoritesLinks.length > 0 && (!searchTerm || favoritesLinks.some(link => matchesSearch(link, searchTerm)))) {
        const favoriteMatches = favoritesLinks.filter(link => !searchTerm || matchesSearch(link, searchTerm));
        
        if (favoriteMatches.length > 0) {
            html += generateCategoryHTML('⭐ Favorites', favoriteMatches, true);
        }
    }
    
    // Generate categories
    if (Object.keys(categoryGroups).length === 0) {
        html += `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No links found. Try a different search term.</p>
            </div>
        `;
    } else {
        for (const category in categoryGroups) {
            html += generateCategoryHTML(category, categoryGroups[category]);
        }
    }
    
    dashboard.innerHTML = html;
    
    // Add event listeners to the newly created elements
    document.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', toggleCategory);
    });
    
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', toggleFavorite);
    });
}

// Check if a link matches search criteria
function matchesSearch(link, searchTerm) {
    searchTerm = searchTerm.toLowerCase();
    return (
        link.name.toLowerCase().includes(searchTerm) ||
        link.category.toLowerCase().includes(searchTerm) ||
        link.url.toLowerCase().includes(searchTerm)
    );
}

// Generate HTML for a category
function generateCategoryHTML(category, links, isFavorites = false) {
    const collapsedState = localStorage.getItem(`category-collapsed-${category}`) === 'true';
    const categoryClass = `category ${collapsedState ? 'collapsed' : ''} ${isFavorites ? 'favorites-category' : ''}`;
    
    return `
        <div class="${categoryClass}" data-category="${category}">
            <div class="category-header">
                <div class="category-header-left">
                    <i class="fas ${isFavorites ? 'fa-star' : 'fa-folder'}"></i>
                    ${category}
                </div>
                <i class="fas fa-chevron-down category-collapse-icon"></i>
            </div>
            <div class="links-grid">
                ${links.map(link => generateLinkHTML(link)).join('')}
            </div>
        </div>
    `;
}

// Generate HTML for a link
function generateLinkHTML(link) {
    const favoriteClass = link.isFavorite ? 'active' : '';
    const icon = link.icon || 'fa-link';
    const color = link.color || '';
    
    return `
        <div class="link-card" data-url="${link.url}">
            <div class="favorite-btn ${favoriteClass}" data-url="${link.url}" title="Add to favorites">
                <i class="fas fa-star"></i>
            </div>
            <i class="fas ${icon}" style="color: ${color};"></i>
            <a href="${link.url}" target="_blank" rel="noopener">${link.name}</a>
        </div>
    `;
}

// Toggle category collapse
function toggleCategory(e) {
    if (e.target.classList.contains('favorite-btn') || e.target.closest('.favorite-btn')) {
        return; // Don't toggle if clicking on favorite button
    }
    
    const category = e.currentTarget.closest('.category');
    category.classList.toggle('collapsed');
    
    // Save collapsed state
    const categoryName = category.dataset.category;
    localStorage.setItem(`category-collapsed-${categoryName}`, category.classList.contains('collapsed'));
}

// Toggle favorite status
function toggleFavorite(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const url = btn.dataset.url;
    
    // Toggle favorite in UI
    btn.classList.toggle('active');
    
    // Update favorites list
    if (btn.classList.contains('active')) {
        if (!favorites.includes(url)) {
            favorites.push(url);
            toast.show('Added to favorites!', 'success');
        }
    } else {
        favorites = favorites.filter(item => item !== url);
        toast.show('Removed from favorites.', 'info');
    }
    
    // Update links data
    linksData = linksData.map(link => {
        if (link.url === url) {
            return { ...link, isFavorite: favorites.includes(url) };
        }
        return link;
    });
    
    // Save to localStorage
    localStorage.setItem('dashboard-favorites', JSON.stringify(favorites));
    
    // Re-render dashboard to update favorites section
    renderDashboard(searchInput.value);
}

// Add a new link
function addNewLink() {
    const name = newLinkForm.name.value.trim();
    const url = newLinkForm.url.value.trim();
    const category = newLinkForm.category.value.trim();
    const icon = newLinkForm.icon.value.trim();
    const color = newLinkForm.color.value;
    
    // Validate input
    if (!name) {
        toast.show('Please enter a name for the link.', 'error');
        newLinkForm.name.focus();
        return;
    }
    
    if (!url) {
        toast.show('Please enter a URL for the link.', 'error');
        newLinkForm.url.focus();
        return;
    }
    
    // Add http:// if missing
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = 'https://' + url;
    }
    
    // Create new link object
    const newLink = {
        name,
        url: validUrl,
        category: category || 'Uncategorized',
        icon: icon || 'fa-link',
        color,
        isFavorite: false,
        isLocal: true
    };
    
    // Add to local links
    localLinks.push(newLink);
    
    // Add to all links
    linksData.push(newLink);
    
    // Add category if new
    if (category && !categories.includes(category)) {
        categories.push(category);
        localStorage.setItem('dashboard-categories', JSON.stringify(categories));
    }
    
    // Save to localStorage
    localStorage.setItem('dashboard-local-links', JSON.stringify(localLinks));
    
    // Close form and render
    closeAddForm();
    renderDashboard();
    
    toast.show('Link added successfully!', 'success');
}

// Open the add form
function openAddForm() {
    quickAddContainer.classList.remove('hidden');
    newLinkForm.name.focus();
    
    // Reset form
    newLinkForm.name.value = '';
    newLinkForm.url.value = '';
    newLinkForm.category.value = '';
    newLinkForm.icon.value = '';
    newLinkForm.color.value = '#4a6cf7';
}

// Close the add form
function closeAddForm() {
    quickAddContainer.classList.add('hidden');
    categorySuggestions.classList.add('hidden');
}

// Show category suggestions
function showCategorySuggestions() {
    const input = newLinkForm.category.value.toLowerCase();
    
    if (!input) {
        categorySuggestions.classList.add('hidden');
        return;
    }
    
    const matches = categories.filter(cat => 
        cat.toLowerCase().includes(input)
    );
    
    if (matches.length === 0) {
        categorySuggestions.classList.add('hidden');
        return;
    }
    
    categorySuggestions.innerHTML = matches.map(cat => 
        `<div class="category-suggestion">${cat}</div>`
    ).join('');
    
    categorySuggestions.classList.remove('hidden');
    
    // Add click listeners
    document.querySelectorAll('.category-suggestion').forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            newLinkForm.category.value = suggestion.textContent;
            categorySuggestions.classList.add('hidden');
        });
    });
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl+K for search focus
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
    
    // Escape to clear search or close modals
    if (e.key === 'Escape') {
        if (!quickAddContainer.classList.contains('hidden')) {
            closeAddForm();
        } else if (document.activeElement === searchInput) {
            searchInput.value = '';
            renderDashboard();
            searchInput.blur();
        }
    }
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    renderDashboard(e.target.value);
});

themeToggle.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('dashboard-theme', settings.theme);
    applySettings();
});

viewToggle.addEventListener('click', () => {
    settings.viewMode = settings.viewMode === 'compact' ? 'expanded' : 'compact';
    localStorage.setItem('dashboard-view-mode', settings.viewMode);
    applySettings();
    toast.show(`Switched to ${settings.viewMode} view`, 'info', 1500);
});

refreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fetchLinks();
});

addButton.addEventListener('click', openAddForm);
cancelAddBtn.addEventListener('click', closeAddForm);
saveAddBtn.addEventListener('click', addNewLink);

newLinkForm.category.addEventListener('input', showCategorySuggestions);
newLinkForm.category.addEventListener('focus', showCategorySuggestions);
newLinkForm.category.addEventListener('blur', () => {
    // Delay hiding to allow for clicks
    setTimeout(() => {
        categorySuggestions.classList.add('hidden');
    }, 200);
});

document.addEventListener('keydown', handleKeyboardShortcuts);

quickAddContainer.addEventListener('click', (e) => {
    if (e.target === quickAddContainer) {
        closeAddForm();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateOnlineStatus();
    applySettings();
    
    const lastUpdated = localStorage.getItem('dashboard-last-updated');
    if (lastUpdated) {
        lastUpdatedSpan.textContent = lastUpdated;
    }
    
    // Load cached categories for suggestions
    const cachedCategories = localStorage.getItem('dashboard-categories');
    if (cachedCategories) {
        categories = JSON.parse(cachedCategories);
    }
    
    // Initialize favorites
    favorites = JSON.parse(localStorage.getItem('dashboard-favorites') || '[]');
    
    // Load data
    fetchLinks();
});

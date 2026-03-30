// Define Firebase config - Users can customize with their own Firebase project credentials
window.__firebase_config = JSON.stringify({
    apiKey: "AIzaSyAyX3Y9TJaTW5HDz0Hb1Z_o6YmpucB9fqc",
    authDomain: "quickbill-33bf7.firebaseapp.com",
    projectId: "quickbill-33bf7",
    storageBucket: "quickbill-33bf7.firebasestorage.app",
    messagingSenderId: "749941620593",
    appId: "1:749941620593:web:4ae8ba14e6b5291dfd00d0"
});

// --- Core State ---
let orders = [];
let completedOrders = [];
let stock = [];
let notes = [];
let companyDetails = {
    companyName: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    defaultBillNotes: '',
    industryMode: 'general',
    gstRate: 0
};

let currentItems = [];
let dashboardRange = 7;
let userId = null;
let isAuthReady = false;
let currentPage = 'dashboard';
let messageTimeout = null;
let resolveConfirmationPromise = null;
let darkMode = false;

// Ensure confirmation modal is hidden on page load
document.addEventListener('DOMContentLoaded', () => {
    const confirmationModal = document.getElementById('confirmation-modal');
    if (confirmationModal) {
        confirmationModal.classList.add('hidden');
    }
});

// --- Dark Mode Functions ---
function toggleDarkMode() {
    darkMode = !darkMode;
    applyDarkMode();
    localStorage.setItem('darkMode', darkMode);
    showToast(darkMode ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️');
}

function applyDarkMode() {
    const html = document.documentElement;
    const toggle = document.getElementById('dark-mode-toggle');
    const slider = document.getElementById('dark-mode-slider');
    const obBtn  = document.getElementById('ob-dark-mode-btn');
    const obIcon  = document.getElementById('ob-dm-icon');
    const obTrack = document.getElementById('ob-dm-track');
    const obThumb = document.getElementById('ob-dm-thumb');

    if (darkMode) {
        html.setAttribute('data-theme', 'dark');
        if (toggle) toggle.style.backgroundColor = '#3b82f6';
        if (slider) {
            slider.style.transform = 'translateX(32px)';
            slider.style.backgroundColor = '#ffffff';
        }
        if (obIcon)  obIcon.textContent = 'dark_mode';
        if (obTrack) obTrack.style.background = '#3b82f6';
        if (obThumb) obThumb.style.transform = 'translateX(0.875rem)';
    } else {
        html.removeAttribute('data-theme');
        if (toggle) toggle.style.backgroundColor = '#cbd5e1';
        if (slider) {
            slider.style.transform = 'translateX(0)';
            slider.style.backgroundColor = '#ffffff';
        }
        if (obIcon)  obIcon.textContent = 'light_mode';
        if (obTrack) obTrack.style.background = '#cbd5e1';
        if (obThumb) obThumb.style.transform = 'translateX(0)';
    }
}

function loadDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
        darkMode = saved === 'true';
    } else {
        // No saved preference — honor the OS/browser setting
        darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyDarkMode();

    // Keep in sync when the OS theme changes (only if the user hasn't
    // explicitly overridden it inside the app)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem('darkMode') === null) {
            darkMode = e.matches;
            applyDarkMode();
        }
    });
}

// --- Industry Mode Functions ---
function getIndustryMode() {
    return companyDetails.industryMode || 'general';
}

function setIndustryMode(mode) {
    companyDetails.industryMode = mode;
    saveDataToLocalStorage('companyDetails', companyDetails);
    updateIndustryModeUI(mode);
    updateStockFormVisibility();
    const labels = { general: 'General', medical: 'Medical', grocery: 'Grocery' };
    showToast(`✅ Industry mode: ${labels[mode] || mode}`);
}

function updateIndustryModeUI(mode) {
    const btns = { general: 'mode-btn-general', medical: 'mode-btn-medical', grocery: 'mode-btn-grocery' };
    Object.entries(btns).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('active', 'active-medical', 'active-grocery');
        if (key === mode) {
            if (mode === 'medical') btn.classList.add('active-medical');
            else if (mode === 'grocery') btn.classList.add('active-grocery');
            else btn.classList.add('active');
        }
    });
    const desc = document.getElementById('industry-mode-description');
    if (desc) {
        const descriptions = {
            general: '🏪 <strong>General</strong> — Standard billing for any business.',
            medical: '💊 <strong>Medical</strong> — Expiry date tracking in inventory, high-risk medicine caution flags in stock and bills.',
            grocery: '🛒 <strong>Grocery</strong> — Expiry date tracking and days-since-added indicator for freshness monitoring.'
        };
        desc.innerHTML = descriptions[mode] || descriptions.general;
    }
}

function updateStockFormVisibility() {
    const mode = getIndustryMode();
    const industryFields = document.getElementById('stock-industry-fields');
    const highRiskField = document.getElementById('stock-high-risk-field');
    if (mode === 'medical' || mode === 'grocery') {
        industryFields?.classList.remove('hidden');
    } else {
        industryFields?.classList.add('hidden');
    }
    if (mode === 'medical') {
        highRiskField?.classList.remove('hidden');
    } else {
        highRiskField?.classList.add('hidden');
    }
}

// --- Helper Functions (Optimized) ---
let toastQueue = [];
let isToastVisible = false;

function showToast(txt) {
    toastQueue.push(txt);
    if (!isToastVisible) {
        displayNextToast();
    }
}

function displayNextToast() {
    if (toastQueue.length === 0) {
        isToastVisible = false;
        return;
    }

    isToastVisible = true;
    const txt = toastQueue.shift();
    const el = document.getElementById('toast-display');
    const inner = document.getElementById('toast-inner');
    document.getElementById('toast-text').innerText = txt;

    // Color-code by message tone
    let bg = '#1f2937';
    if (txt.startsWith('✅') || txt.includes('success') || txt.includes('saved') || txt.includes('added') || txt.includes('updated') || txt.includes('synced')) {
        bg = '#059669';
    } else if (txt.startsWith('❌') || txt.includes('failed') || txt.includes('Failed') || txt.includes('Error') || txt.includes('error') || txt.includes('Invalid') || txt.includes('cannot') || txt.includes('Cannot')) {
        bg = '#dc2626';
    } else if (txt.startsWith('⚠️') || txt.includes('Insufficient') || txt.includes('warning')) {
        bg = '#d97706';
    }
    if (inner) inner.style.background = bg;

    // Re-trigger animation
    if (inner) { inner.classList.remove('animate-toast-up'); void inner.offsetWidth; inner.classList.add('animate-toast-up'); }

    el.classList.remove('hidden');
    setTimeout(() => {
        el.classList.add('hidden');
        setTimeout(displayNextToast, 150);
    }, 2200);
}

function showConfirmation(message) {
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    if (!confirmationModal || !confirmationMessage) {
        console.error('Confirmation modal elements not found');
        return Promise.resolve(false);
    }
    confirmationMessage.textContent = message;
    confirmationModal.classList.remove('hidden');
    return new Promise(resolve => {
        resolveConfirmationPromise = resolve;
    });
}

// Setup confirmation modal event listeners when DOM is ready
function setupConfirmationModal() {
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');

    // Ensure modal is hidden on initialization
    if (confirmationModal) {
        confirmationModal.classList.add('hidden');
    }

    if (confirmYes && confirmNo) {
        // Remove any existing listeners by cloning
        const newYes = confirmYes.cloneNode(true);
        const newNo = confirmNo.cloneNode(true);
        confirmYes.parentNode.replaceChild(newYes, confirmYes);
        confirmNo.parentNode.replaceChild(newNo, confirmNo);

        newYes.addEventListener('click', () => {
    document.getElementById('confirmation-modal').classList.add('hidden');
            if (resolveConfirmationPromise) {
    resolveConfirmationPromise(true);
                resolveConfirmationPromise = null;
            }
});

        newNo.addEventListener('click', () => {
    document.getElementById('confirmation-modal').classList.add('hidden');
            if (resolveConfirmationPromise) {
    resolveConfirmationPromise(false);
                resolveConfirmationPromise = null;
            }
});
    }
}

// --- Local Storage Functions ---
const getLocalStorageKey = (key) => {
    return `quickbill-${userId}-${key}`;
};

const loadDataFromLocalStorage = (key, defaultValue) => {
    try {
        const lsKey = getLocalStorageKey(key);
        const data = localStorage.getItem(lsKey);
        const parsedData = data ? JSON.parse(data) : defaultValue;
        return parsedData;
    } catch (error) {
        console.error(`[LocalStorage] Error loading ${key}:`, error);
        return defaultValue;
    }
};

const saveDataToLocalStorage = (key, data) => {
    try {
        const lsKey = getLocalStorageKey(key);

        let dataToStore = data;
        if (key === 'orders') {
            dataToStore = data.map(item => ({
                ...item,
                orderDate: item.orderDate ? new Date(item.orderDate).toISOString() : new Date().toISOString()
            }));
        } else if (key === 'notes') {
            dataToStore = data.map(note => ({
                ...note,
                createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString()
            }));
        }

        localStorage.setItem(lsKey, JSON.stringify(dataToStore));
        // Trigger auto-sync only for online mode
        if (shouldAutoSync()) {
            window.scheduleAutoSync();
        }
    } catch (error) {
        console.error(`[LocalStorage] Error saving ${key}:`, error);
    }
};

// --- Barcode Engine ---
let isScannerActive = false;

function generateBarcodeNumber() {
    const last = parseInt(localStorage.getItem('quickbill-barcode-seq') || '100000');
    const next = last + 1;
    localStorage.setItem('quickbill-barcode-seq', next.toString());
    return next.toString();
}

function isExpiredMedicine(stockItem) {
    if (getIndustryMode() !== 'medical') return false;
    if (!stockItem || !stockItem.expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(stockItem.expiryDate);
    if (expDate < today) {
        showToast(`⛔ "${stockItem.name}" is expired (${expDate.toLocaleDateString()}). Cannot be added to bill.`);
        return true;
    }
    return false;
}

function lookupBarcode(code) {
    const normalizedCode = (code || '').toString().trim();
    if (!normalizedCode) return;
    const item = stock.find(s => s.barcode && s.barcode.toString().trim() === normalizedCode);
    if (item) {
        if (isExpiredMedicine(item)) return;
        addItemRowWithData(item.name, item.price);
        showToast(`✅ Added: ${item.name} (₹${item.price.toFixed(2)})`);
        const input = document.getElementById('barcode-lookup-input');
        if (input) input.value = '';
    } else {
        showToast(`❌ No product found for barcode: ${normalizedCode}`);
        const input = document.getElementById('barcode-lookup-input');
        if (input) input.select();
    }
}

function startScanner() {
    if (isScannerActive) return;

    // Ensure stock is loaded
    if (!stock || stock.length === 0) {
        showToast('No products in stock. Please add products to inventory first.');
        return;
    }

    console.log('Starting scanner with', stock.length, 'products in stock');

    isScannerActive = true;
    document.getElementById('scanner-overlay').style.display = 'flex';

    Quagga.init({
        inputStream: { 
            name: "Live", 
            type: "LiveStream", 
            target: document.querySelector('#interactive'), 
            constraints: { facingMode: "environment" } 
        },
        decoder: { 
            readers: ["code_128_reader", "ean_reader", "upc_reader", "ean_8_reader", "code_39_reader"] 
        },
        locate: true
    }, function(err) {
        if(err) { 
            showToast("Camera Error: " + err); 
            isScannerActive = false;
            document.getElementById('scanner-overlay').style.display = 'none';
            return; 
        }
        Quagga.start();

        // Set up detection handler after initialization
        Quagga.onDetected(function(data) {
            if (!isScannerActive) return;
            const code = data.codeResult.code;
            stopScanner();
            lookupBarcode(code);
        });
    });
}

function stopScanner() {
    if (!isScannerActive) return;
    isScannerActive = false;
    try {
    Quagga.stop();
    } catch(e) {
        console.log('Scanner already stopped');
    }
    document.getElementById('scanner-overlay').style.display = 'none';
}

// --- Autocomplete Functions (Optimized with Debouncing) ---
let autocompleteTimer;

function showAutocomplete(input, value, index) {
    // Debounce for performance
    clearTimeout(autocompleteTimer);
    autocompleteTimer = setTimeout(() => {
        showAutocompleteImmediate(input, value, index);
    }, 150);
}

function showAutocompleteImmediate(input, value, index) {
    closeAllLists();
    if (!value) return;

    const autocompleteList = document.createElement('div');
    autocompleteList.setAttribute('id', `autocomplete-list-${index}`);
    autocompleteList.className = 'autocomplete-items';

    // Position anchored to the input using viewport coords.
    // Appending to document.body bypasses any ancestor contain/transform/overflow
    // that would clip or re-contain a position:fixed descendant.
    const rect = input.getBoundingClientRect();
    autocompleteList.style.top = rect.bottom + 'px';
    autocompleteList.style.left = rect.left + 'px';
    autocompleteList.style.width = rect.width + 'px';

    // Optimize: Limit results to 10 for better performance
    const matches = stock
        .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10);

    if (matches.length === 0) return;

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    matches.forEach(item => {
        const suggestionDiv = document.createElement('div');
        const matchStart = item.name.toLowerCase().indexOf(value.toLowerCase());
        const matchEnd = matchStart + value.length;

        suggestionDiv.innerHTML = 
            item.name.substr(0, matchStart) +
            `<strong>${item.name.substr(matchStart, value.length)}</strong>` +
            item.name.substr(matchEnd) +
            ` <span style="color: #6b7280; font-size: 0.875rem;">(₹${item.price.toFixed(2)})</span>`;

        suggestionDiv.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur before selection
            if (isExpiredMedicine(item)) { closeAllLists(); return; }
            input.value = item.name;
            currentItems[index].product = item.name;
            currentItems[index].pricePerUnit = parseFloat(item.price);
            currentItems[index].total = (isNaN(currentItems[index].quantity) || currentItems[index].quantity === '' ? 0 : currentItems[index].quantity) * currentItems[index].pricePerUnit;
            updateProductsTable();
            calculateAndDisplayGrandTotal();
            closeAllLists();

            // Focus on quantity field
            const container = document.getElementById('bill-items-container');
            const quantityInput = container.querySelector(`input[data-index="${index}"][data-field="quantity"]`);
            if (quantityInput) quantityInput.focus();
        });

        fragment.appendChild(suggestionDiv);
    });

    autocompleteList.appendChild(fragment);
    document.body.appendChild(autocompleteList);
}

function closeAllLists() {
    const lists = document.getElementsByClassName('autocomplete-items');
    Array.from(lists).forEach(list => list.remove());
}

// --- Navigation (Optimized) ---
function renderPage(id) {
    currentPage = id;
    // Use requestAnimationFrame for smooth transitions
    requestAnimationFrame(() => {
        document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));

        const target = document.getElementById(`page-${id}`);
        if(target) target.style.display = 'block';

        const navBtn = document.getElementById(`nav-${id}`);
        if(navBtn) {
            navBtn.classList.add('active');
        }

        const mobileNavItem = document.querySelector(`.mobile-nav-item[data-page="${id}"]`);
        if(mobileNavItem) mobileNavItem.classList.add('active');

        // Defer heavy rendering operations
        requestAnimationFrame(() => {
            if(id === 'dashboard') updateDashboardData(dashboardRange);
            if(id === 'stock') renderStock();
            if(id === 'allOrders') renderAllOrders();
            if(id === 'notes') renderNotes();
            if(id === 'settings') renderSettings();
            if(id === 'addOrder') renderAddOrderForm();
        });
    });
}

// --- Hamburger Menu Logic ---
const hamburgerToggle = document.getElementById('hamburger-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
const mobileMenuClose = document.getElementById('mobile-menu-close');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

hamburgerToggle.addEventListener('click', () => {
    mobileMenu.classList.add('open');
    mobileMenuOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
});

const closeMenu = () => {
    mobileMenu.classList.remove('open');
    mobileMenuOverlay.classList.remove('open');
    document.body.style.overflow = '';
};

mobileMenuClose.addEventListener('click', closeMenu);
mobileMenuOverlay.addEventListener('click', closeMenu);

mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;

        // Close menu first for smoother UX
        closeMenu();

        // Update active state
        mobileNavItems.forEach(navItem => {
            navItem.classList.remove('active');
        });
        item.classList.add('active');

        // Render page after menu closes
        setTimeout(() => {
            renderPage(page);
        }, 100);
    });
});

// --- Dashboard Logic ---
function updateDashboardData(daysRange) {
    document.querySelectorAll('.date-filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.date-filter-button[data-range="${daysRange}"]`).classList.add('active');

    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(endDate.getDate() - daysRange);

    const previousEndDate = new Date(startDate);
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysRange);

    const allOrders = [...orders, ...completedOrders];
    const currentPeriodOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= startDate && orderDate <= endDate;
    });

    const previousPeriodOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= previousStartDate && orderDate < startDate;
    });

    const currentRevenue = currentPeriodOrders.reduce((sum, order) => sum + order.grandTotal, 0);
    const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + order.grandTotal, 0);
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue * 100) : 0;

    const currentOrdersCount = currentPeriodOrders.length;
    const previousOrdersCount = previousPeriodOrders.length;
    const ordersChange = previousOrdersCount > 0 ? ((currentOrdersCount - previousOrdersCount) / previousOrdersCount * 100) : 0;

    const currentCustomers = [...new Set(currentPeriodOrders.map(order => order.buyerName))].length;
    const previousCustomers = [...new Set(previousPeriodOrders.map(order => order.buyerName))].length;
    const customersChange = previousCustomers > 0 ? ((currentCustomers - previousCustomers) / previousCustomers * 100) : 0;

    const lowStockCount = stock.filter(item => item.quantity <= 5).length;

    document.getElementById('total-revenue').textContent = `₹${currentRevenue.toFixed(2)}`;
    document.getElementById('total-orders').textContent = currentOrdersCount;
    document.getElementById('active-customers').textContent = currentCustomers;
    document.getElementById('low-stock-count').textContent = lowStockCount;

    updateChangeIndicator('revenue-change', revenueChange, 'revenue');
    updateChangeIndicator('orders-change', ordersChange, 'orders');
    updateChangeIndicator('customers-change', customersChange, 'customers');

    renderRevenueChart(currentPeriodOrders, daysRange);
    renderOrdersChart(currentPeriodOrders, daysRange);
    renderTopProducts(currentPeriodOrders);
    renderRecentActivity(currentPeriodOrders);
    renderStockStatus();
    renderExpiryStatus();
}

function updateChangeIndicator(elementId, change, type) {
    const element = document.getElementById(elementId);
    const isPositive = change >= 0;

    element.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
    element.innerHTML = `
        <i class="material-icons text-sm">${isPositive ? 'arrow_upward' : 'arrow_downward'}</i>
        <span>${Math.abs(change).toFixed(1)}% vs prev</span>
    `;

    if (type === 'stock') {
        const lowStockCount = stock.filter(item => item.quantity <= 5).length;
        element.querySelector('span').textContent = `${lowStockCount} need restock`;
    }
}

function renderRevenueChart(orders, daysRange) {
    const chartContainer = document.getElementById('revenue-chart');
    chartContainer.innerHTML = '';

    let groupedData = {};
    const now = new Date();

    if (daysRange <= 30) {
        for (let i = daysRange - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            groupedData[dateKey] = 0;
        }

        orders.forEach(order => {
            const orderDate = new Date(order.orderDate).toISOString().split('T')[0];
            if (groupedData[orderDate] !== undefined) {
                groupedData[orderDate] += order.grandTotal;
            }
        });
    } else {
        const weeks = Math.ceil(daysRange / 7);
        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            groupedData[`Week ${weeks - i}`] = 0;
        }

        orders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const diffTime = Math.abs(now - orderDate);
            const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
            if (diffWeeks <= weeks) {
                groupedData[`Week ${weeks - diffWeeks + 1}`] += order.grandTotal;
            }
        });
    }

    const values = Object.values(groupedData);
    const maxValue = Math.max(...values, 1);

    Object.entries(groupedData).forEach(([label, value]) => {
        const barHeight = (value / maxValue) * 130;

        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${barHeight}px`;
        bar.title = `₹${value.toFixed(2)}`;

        // Add value label on top of bar
        const valueLabel = document.createElement('div');
        valueLabel.className = 'bar-value';
        valueLabel.textContent = value > 0 ? `₹${value.toFixed(0)}` : '';

        const barLabel = document.createElement('div');
        barLabel.className = 'bar-label';
        barLabel.textContent = daysRange <= 30 ? 
            new Date(label).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 
            label;

        barContainer.appendChild(valueLabel);
        barContainer.appendChild(bar);
        barContainer.appendChild(barLabel);
        chartContainer.appendChild(barContainer);
    });
}

function renderOrdersChart(orders, daysRange) {
    const chartContainer = document.getElementById('orders-chart');
    chartContainer.innerHTML = '';

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    const dataPoints = [];
    const now = new Date();

    if (daysRange <= 30) {
        for (let i = 0; i < daysRange; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (daysRange - 1 - i));
            dataPoints.push({ date: date.toISOString().split('T')[0], count: 0 });
        }
        orders.forEach(order => {
            const orderDate = new Date(order.orderDate).toISOString().split('T')[0];
            const dp = dataPoints.find(d => d.date === orderDate);
            if (dp) dp.count++;
        });
    } else {
        const weeks = Math.ceil(daysRange / 7);
        for (let i = 0; i < weeks; i++) dataPoints.push({ label: `Wk ${i + 1}`, count: 0 });
        orders.forEach(order => {
            const diffWeeks = Math.ceil(Math.abs(now - new Date(order.orderDate)) / (1000 * 60 * 60 * 24 * 7));
            if (diffWeeks <= weeks) dataPoints[weeks - diffWeeks].count++;
        });
    }

    // Chart geometry constants
    const svgHeight = 240;
    const chartTop = 25;     // top of the plotted area (where maxCount lives)
    const chartBottom = 190; // bottom of the plotted area (where 0 lives)
    const leftMargin = 40;
    const rightMargin = 40;

    const minWidth = 600;
    const pointSpacing = Math.max(35, Math.floor((minWidth - leftMargin - rightMargin) / Math.max(dataPoints.length, 1)));
    const calculatedWidth = Math.max(minWidth, leftMargin + dataPoints.length * pointSpacing + rightMargin);

    svg.setAttribute("width", calculatedWidth);
    svg.setAttribute("height", svgHeight);
    svg.setAttribute("viewBox", `0 0 ${calculatedWidth} ${svgHeight}`);
    svg.style.minWidth = `${calculatedWidth}px`;
    svg.style.display = 'block';

    const maxCount = Math.max(...dataPoints.map(d => d.count), 1);
    const chartAreaHeight = chartBottom - chartTop; // 165

    // Y-axis grid lines (5 lines: 0 … maxCount in 4 steps)
    for (let i = 0; i <= 4; i++) {
        const y = chartBottom - (i / 4) * chartAreaHeight;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", leftMargin); line.setAttribute("y1", y);
        line.setAttribute("x2", calculatedWidth - rightMargin); line.setAttribute("y2", y);
        line.setAttribute("class", "chart-grid-line");
        svg.appendChild(line);

        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", leftMargin - 6);
        label.setAttribute("y", y + 4);
        label.setAttribute("text-anchor", "end");
        label.setAttribute("font-size", "10");
        label.setAttribute("fill", "#6b7280");
        label.textContent = Math.round((maxCount / 4) * i);
        svg.appendChild(label);
    }

    // Y-axis title
    const yTitle = document.createElementNS(svgNS, "text");
    yTitle.setAttribute("x", "12");
    yTitle.setAttribute("y", (chartTop + chartBottom) / 2);
    yTitle.setAttribute("text-anchor", "middle");
    yTitle.setAttribute("font-size", "9");
    yTitle.setAttribute("fill", "#9ca3af");
    yTitle.setAttribute("transform", `rotate(-90, 12, ${(chartTop + chartBottom) / 2})`);
    yTitle.textContent = "Orders";
    svg.appendChild(yTitle);

    // Compute (x, y) for each data point using the CORRECT formula:
    //   count=0  → y = chartBottom
    //   count=max → y = chartTop
    const xStep = dataPoints.length > 1 ? (calculatedWidth - leftMargin - rightMargin) / (dataPoints.length - 1) : 0;
    const coordOf = (dp, i) => ({
        x: leftMargin + i * xStep,
        y: chartBottom - (dp.count / maxCount) * chartAreaHeight
    });

    const coords = dataPoints.map(coordOf);

    // Area fill
    const areaPointsStr = coords.map(c => `${c.x},${c.y}`).join(' ') +
        ` ${coords[coords.length - 1].x},${chartBottom} ${coords[0].x},${chartBottom}`;
    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", areaPointsStr);
    polygon.setAttribute("class", "area-path");
    svg.appendChild(polygon);

    // Line
    const polyline = document.createElementNS(svgNS, "polyline");
    polyline.setAttribute("points", coords.map(c => `${c.x},${c.y}`).join(' '));
    polyline.setAttribute("class", "line-path");
    polyline.setAttribute("fill", "none");
    svg.appendChild(polyline);

    // Determine how often to show x-axis labels to avoid crowding
    let labelInterval;
    if (daysRange <= 7) {
        labelInterval = 1;
    } else if (daysRange <= 30) {
        labelInterval = 5;
    } else if (daysRange <= 90) {
        labelInterval = 2;
    } else {
        labelInterval = 6;
    }

    // Data point circles + x-axis labels
    dataPoints.forEach((dp, i) => {
        const { x, y } = coords[i];

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", x); circle.setAttribute("cy", y);
        circle.setAttribute("r", "4"); circle.setAttribute("fill", "#3b82f6");
        svg.appendChild(circle);

        // Tooltip title
        const title = document.createElementNS(svgNS, "title");
        const labelText = daysRange <= 30
            ? new Date(dp.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            : dp.label;
        title.textContent = `${labelText}: ${dp.count} order${dp.count !== 1 ? 's' : ''}`;
        circle.appendChild(title);

        // X-axis label (only every Nth point to avoid crowding)
        if (i % labelInterval === 0 || i === dataPoints.length - 1) {
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", x);
            text.setAttribute("y", chartBottom + 22);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "9");
            text.setAttribute("fill", "#6b7280");
            text.textContent = labelText;
            svg.appendChild(text);
        }
    });

    chartContainer.appendChild(svg);
}

function renderTopProducts(orders) {
    const topProductsContainer = document.getElementById('top-products');
    topProductsContainer.innerHTML = '';

    const productSales = {};
    orders.forEach(order => {
        order.items.forEach(item => {
            if (!productSales[item.product]) {
                productSales[item.product] = {
                    quantity: 0,
                    revenue: 0
                };
            }
            productSales[item.product].quantity += item.quantity;
            productSales[item.product].revenue += item.total;
        });
    });

    const topProducts = Object.entries(productSales)
        .map(([product, data]) => ({
            product,
            ...data
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    const maxRevenue = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.revenue)) : 1;

    topProducts.forEach((product, index) => {
        const percentage = (product.revenue / maxRevenue) * 100;

        const listItem = document.createElement('li');
        listItem.className = 'top-product-item';

        listItem.innerHTML = `
            <div class="product-info">
                <div class="product-rank ${index < 3 ? `product-rank-${index + 1}` : ''}">${index + 1}</div>
                <div>
                    <div class="font-medium">${product.product}</div>
                    <div class="text-sm text-gray-500">${product.quantity} sold</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </div>
            <div class="product-sales">₹${product.revenue.toFixed(2)}</div>
        `;

        topProductsContainer.appendChild(listItem);
    });

    if (topProducts.length === 0) {
        topProductsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No sales data available</p>';
    }
}

function renderRecentActivity(orders) {
    const activityContainer = document.getElementById('recent-activity');
    activityContainer.innerHTML = '';

    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
        .slice(0, 5);

    recentOrders.forEach(order => {
        const activityItem = document.createElement('div');
        activityItem.className = 'recent-activity-item';

        const timeAgo = getTimeAgo(new Date(order.orderDate));

        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="material-icons">receipt</i>
            </div>
            <div class="activity-details">
                <div class="activity-title">New order from ${order.buyerName}</div>
                <div class="activity-time">${timeAgo}</div>
            </div>
            <div class="activity-amount">₹${order.grandTotal.toFixed(2)}</div>
        `;

        activityContainer.appendChild(activityItem);
    });

    if (recentOrders.length === 0) {
        activityContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No recent activity</p>';
    }
}

function renderStockStatus() {
    const stockContainer = document.getElementById('stock-status');
    stockContainer.innerHTML = '';

    const lowStockItems = stock
        .filter(item => item.quantity <= 10)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);

    lowStockItems.forEach(item => {
        const stockItem = document.createElement('div');
        stockItem.className = 'recent-activity-item';

        const statusClass = item.quantity <= 5 ? 'low-stock' : '';
        const statusText = item.quantity <= 5 ? 'Low Stock' : 'Moderate Stock';

        stockItem.innerHTML = `
            <div class="activity-icon">
                <i class="material-icons">inventory_2</i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${item.name}</div>
                <div class="activity-time">${statusText}</div>
            </div>
            <div class="${statusClass}">${item.quantity} left</div>
        `;

        stockContainer.appendChild(stockItem);
    });

    if (lowStockItems.length === 0) {
        stockContainer.innerHTML = '<p class="text-gray-500 text-center py-4">All items are well stocked</p>';
    }
}

function renderExpiryStatus() {
    const expiryContainer = document.getElementById('expiry-status');
    if (!expiryContainer) return;
    expiryContainer.innerHTML = '';

    const mode = getIndustryMode();
    if (mode === 'general') {
        expiryContainer.innerHTML = `<p class="py-4 text-sm text-center" style="color:var(--text-secondary);">Enable <strong>Medical</strong> or <strong>Grocery</strong> mode in Settings to track product expiry.</p>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const MS_PER_DAY = 86400000;
    const itemsWithExpiry = stock
        .filter(item => item.expiryDate)
        .map(item => {
            const expDate = new Date(item.expiryDate);
            const diffDays = Math.ceil((expDate - today) / MS_PER_DAY);
            return { ...item, diffDays, expDate };
        })
        .sort((a, b) => a.diffDays - b.diffDays);

    if (itemsWithExpiry.length === 0) {
        expiryContainer.innerHTML = `<p class="py-4 text-sm text-center" style="color:var(--text-secondary);">No items with expiry dates tracked. Add expiry dates to your inventory items.</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    itemsWithExpiry.forEach(item => {
        const el = document.createElement('div');
        el.className = 'recent-activity-item';
        let badgeClass, badgeText, iconName;
        if (item.diffDays < 0) {
            badgeClass = 'expired';
            badgeText = `⛔ Expired ${Math.abs(item.diffDays)}d ago`;
            iconName = 'dangerous';
        } else if (item.diffDays <= 30) {
            badgeClass = 'warn';
            badgeText = `⚠️ Expires in ${item.diffDays}d`;
            iconName = 'warning';
        } else {
            badgeClass = 'ok';
            badgeText = `✅ ${item.expDate.toLocaleDateString()}`;
            iconName = 'check_circle';
        }
        el.innerHTML = `
            <div class="activity-icon"><i class="material-icons">${iconName}</i></div>
            <div class="activity-details">
                <div class="activity-title">${item.name}</div>
                <div class="activity-time"><span class="expiry-badge ${badgeClass}">${badgeText}</span></div>
            </div>
            <div class="font-semibold text-sm" style="color:var(--text-secondary);">${item.quantity} units</div>
        `;
        fragment.appendChild(el);
    });
    expiryContainer.appendChild(fragment);
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

// --- Add Order Form Logic ---
function renderAddOrderForm() {
    const buyerNameInput = document.getElementById('buyerName');
    buyerNameInput.value = '';
    currentItems = [{
        product: '',
        quantity: '',
        pricePerUnit: 0,
        total: 0
    }];
    // Populate GST rate label from saved settings
    const gstRate = companyDetails.gstRate || 0;
    document.getElementById('gst-rate-label').textContent = gstRate;
    document.getElementById('apply-gst').checked = false;
    document.getElementById('gst-breakdown').classList.add('hidden');
    updateProductsTable();
    calculateAndDisplayGrandTotal();
}

function updateProductsTable() {
    const container = document.getElementById('bill-items-container');
    container.innerHTML = '';
    const mode = getIndustryMode();

    currentItems.forEach((item, index) => {
        // Check if this product is a high-risk medicine
        const stockMatch = stock.find(s => s.name.toLowerCase() === item.product.trim().toLowerCase());
        const isMedicalRisk = mode === 'medical' && stockMatch && stockMatch.isHighRisk;
        const cautionHtml = isMedicalRisk
            ? `<span class="caution-badge"><i class="material-icons" style="font-size:0.8rem;">warning</i>CAUTION</span>`
            : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-3 px-4">
                <div class="autocomplete-container">
                    <input type="text" data-field="product" data-index="${index}" value="${item.product}"
                        class="block w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        style="background-color: var(--input-bg); color: var(--text-primary); border: 1px solid var(--border-color);" placeholder="Product Name" required />
                    ${cautionHtml}
                </div>
            </td>
            <td class="py-3 px-4" data-label="Qty">
                <input type="number" data-field="quantity" data-index="${index}" value="${item.quantity || ''}" step="1" min="1"
                    class="block w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style="background-color: var(--input-bg); color: var(--text-primary); border: 1px solid var(--border-color);" placeholder="Qty" required />
            </td>
            <td class="py-3 px-4" data-label="Price">
                <input type="number" data-field="pricePerUnit" data-index="${index}" value="${item.pricePerUnit || ''}" step="0.01"
                    class="block w-full px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style="background-color: var(--input-bg); color: var(--text-primary); border: 1px solid var(--border-color);" placeholder="Price" min="0" required />
            </td>
            <td class="py-3 px-4 text-right font-medium text-lg">
                ₹<span class="item-total">${item.total.toFixed(2)}</span>
            </td>
            <td class="py-3 px-4 text-center">
                <button type="button" data-action="remove" data-index="${index}" class="text-red-400 hover:text-red-600 text-xl font-bold transition-colors">&times;</button>
            </td>
        `;
        container.appendChild(row);
    });

    attachProductInputListeners();
}

function addItemRow() {
    const lastItem = currentItems.length > 0 ? currentItems[currentItems.length - 1] : null;
    if (lastItem && lastItem.product.trim() === '') {
        const lastIndex = currentItems.length - 1;
        const lastInput = document.querySelector(`input[data-index="${lastIndex}"][data-field="product"]`);
        if (lastInput) lastInput.focus();
        return;
    }
    currentItems.push({
        product: '',
        quantity: '',
        pricePerUnit: 0,
        total: 0
    });
    updateProductsTable();

    // Auto-focus the new row's product input
    setTimeout(() => {
        const newIndex = currentItems.length - 1;
        const newInput = document.querySelector(`input[data-index="${newIndex}"][data-field="product"]`);
        if (newInput) newInput.focus();
    }, 50);
}

function addItemRowWithData(name, price) {
    currentItems.push({
        product: name,
        quantity: 1,
        pricePerUnit: price,
        total: price
    });
    updateProductsTable();
    calculateAndDisplayGrandTotal();
}

function removeItemRow(index) {
    if (currentItems.length === 1) {
        currentItems[0] = { product: '', quantity: '', pricePerUnit: 0, total: 0 };
    } else {
        currentItems.splice(index, 1);
    }
    updateProductsTable();
    calculateAndDisplayGrandTotal();
}

function calculateAndDisplayGrandTotal() {
    const subtotal = currentItems.reduce((sum, item) => sum + (isNaN(item.total) ? 0 : item.total), 0);
    const applyGst = document.getElementById('apply-gst').checked;
    const gstRate = companyDetails.gstRate || 0;
    const gstAmount = applyGst ? subtotal * gstRate / 100 : 0;
    const total = subtotal + gstAmount;

    document.getElementById('bill-subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('gst-pct-label2').textContent = gstRate;
    document.getElementById('bill-gst-amount').textContent = gstAmount.toFixed(2);
    document.getElementById('gst-breakdown').classList.toggle('hidden', !applyGst);
    document.getElementById('grand-total').textContent = total.toFixed(2);
}

function attachProductInputListeners() {
    const container = document.getElementById('bill-items-container');
    const inputs = container.querySelectorAll('input[data-field]');
    inputs.forEach(input => {
        input.oninput = (e) => {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            let value = e.target.value;

            if (field === 'product') {
                currentItems[index][field] = value;
                // Show autocomplete suggestions
                showAutocomplete(e.target, value, index);
            } else if (field === 'quantity' || field === 'pricePerUnit') {
                currentItems[index][field] = value === '' ? '' : parseFloat(value);
            }

            const quantity = currentItems[index].quantity;
            const pricePerUnit = currentItems[index].pricePerUnit;
            currentItems[index].total = (isNaN(quantity) || quantity === '' ? 0 : quantity) * (isNaN(pricePerUnit) || pricePerUnit === '' ? 0 : pricePerUnit);

            e.target.closest('tr').querySelector('.item-total').textContent = currentItems[index].total.toFixed(2);
            calculateAndDisplayGrandTotal();
        };

        // Auto-fill price from stock
        if (input.dataset.field === 'product') {
            input.addEventListener('change', (e) => {
                const productName = e.target.value.trim();
                const index = parseInt(e.target.dataset.index);
                const stockItem = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());

                if (stockItem) {
                    if (isExpiredMedicine(stockItem)) {
                        currentItems[index].product = '';
                        currentItems[index].pricePerUnit = 0;
                        currentItems[index].total = 0;
                        updateProductsTable();
                        calculateAndDisplayGrandTotal();
                        // Refocus the product input so the user can re-enter
                        setTimeout(() => {
                            const billContainer = document.getElementById('bill-items-container');
                            const productInputEl = billContainer.querySelector(`input[data-index="${index}"][data-field="product"]`);
                            if (productInputEl) productInputEl.focus();
                        }, 50);
                        return;
                    }
                    const qty = isNaN(currentItems[index].quantity) || currentItems[index].quantity === '' ? 0 : currentItems[index].quantity;
                    currentItems[index].pricePerUnit = parseFloat(stockItem.price);
                    currentItems[index].total = qty * currentItems[index].pricePerUnit;
                    // Update price and total in-place — do NOT call updateProductsTable()
                    // which would rebuild the DOM and steal focus from the next field.
                    const billContainer = document.getElementById('bill-items-container');
                    const priceInput = billContainer.querySelector(`input[data-index="${index}"][data-field="pricePerUnit"]`);
                    if (priceInput) {
                        priceInput.value = currentItems[index].pricePerUnit;
                        const totalEl = priceInput.closest('tr').querySelector('.item-total');
                        if (totalEl) totalEl.textContent = currentItems[index].total.toFixed(2);
                    }
                    calculateAndDisplayGrandTotal();
                }
            });

            // Close autocomplete when clicking outside
            input.addEventListener('blur', () => {
                setTimeout(() => closeAllLists(), 200);
            });
        }

        // Enter key navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;

                let nextInput = null;
                if (field === 'product') {
                    nextInput = container.querySelector(`input[data-index="${index}"][data-field="quantity"]`);
                } else if (field === 'quantity') {
                    nextInput = container.querySelector(`input[data-index="${index}"][data-field="pricePerUnit"]`);
                } else if (field === 'pricePerUnit') {
                    if (index === currentItems.length - 1) {
                        addItemRow();
                        setTimeout(() => {
                            const newInput = container.querySelector(`input[data-index="${index + 1}"][data-field="product"]`);
                            if (newInput) newInput.focus();
                        }, 50);
                    } else {
                        nextInput = container.querySelector(`input[data-index="${index + 1}"][data-field="product"]`);
                    }
                }

                if (nextInput) {
                    nextInput.focus();
                }
            }
        });
    });

    container.querySelectorAll('button[data-action="remove"]').forEach(button => {
        button.onclick = (e) => {
            const index = parseInt(e.target.dataset.index);
            removeItemRow(index);
        };
    });
}

document.getElementById('add-item-row-btn').addEventListener('click', addItemRow);

document.getElementById('buyerName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (currentItems.length === 0) {
            addItemRow();
        }
        document.querySelector('input[data-index="0"][data-field="product"]')?.focus();
    }
});

document.getElementById('add-order-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!userId) {
        showToast("User not authenticated. Please try again.");
        return;
    }

    const buyerNameInput = document.getElementById('buyerName');
    const deductFromStockCheckbox = document.getElementById('deduct-from-stock');

    if (!buyerNameInput.value.trim()) {
        showToast("Buyer name cannot be empty.");
        return;
    }

    if (currentItems.length === 0) {
        showToast("Bill must contain at least one product.");
        return;
    }

    let allItemsValid = true;
    currentItems.forEach((item, index) => {
        if (!item.product.trim()) {
            showToast(`Product name for item ${index + 1} cannot be empty.`);
            allItemsValid = false;
        } else if (isNaN(item.quantity) || item.quantity <= 0) {
            showToast(`Quantity for product "${item.product}" must be a positive number.`);
            allItemsValid = false;
        } else if (isNaN(item.pricePerUnit) || item.pricePerUnit < 0) {
            showToast(`Price per unit for product "${item.product}" must be a non-negative number.`);
            allItemsValid = false;
        }
    });

    if (!allItemsValid) {
        return;
    }

    const deductFromStock = deductFromStockCheckbox.checked;
    if (deductFromStock) {
        let insufficientStockItems = [];
        currentItems.forEach(item => {
            const stockItem = stock.find(s => s.name.toLowerCase() === item.product.trim().toLowerCase());
            if (stockItem) {
                if (stockItem.quantity < item.quantity) {
                    insufficientStockItems.push({
                        product: item.product,
                        available: stockItem.quantity,
                        requested: item.quantity
                    });
                }
            } else {
                insufficientStockItems.push({
                    product: item.product,
                    available: 0,
                    requested: item.quantity
                });
            }
        });

        if (insufficientStockItems.length > 0) {
            let message = "Insufficient stock for the following items:\n";
            insufficientStockItems.forEach(item => {
                message += `- ${item.product}: Available ${item.available}, Requested ${item.requested}\n`;
            });
            message += "\nPlease adjust quantities or uncheck 'Deduct from stock' to proceed.";
            showToast(message);
            return;
        }
    }

    const newOrder = {
        id: 'INV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        buyerName: buyerNameInput.value.trim(),
        orderDate: new Date(),
        items: currentItems.map(item => ({
            product: item.product.trim(),
            quantity: parseFloat(item.quantity),
            pricePerUnit: parseFloat(item.pricePerUnit),
            total: parseFloat(item.total)
        })),
        grandTotal: parseFloat(document.getElementById('grand-total').textContent),
        isSeen: false,
        isDelivered: false,
        isEditing: false,
        isExpanded: false,
        companyDetails: { ...companyDetails }
    };

    if (deductFromStock) {
        currentItems.forEach(item => {
            const stockItemIndex = stock.findIndex(s => s.name.toLowerCase() === item.product.trim().toLowerCase());
            if (stockItemIndex !== -1) {
                stock[stockItemIndex].quantity -= item.quantity;
                if (stock[stockItemIndex].quantity < 0) {
                    stock[stockItemIndex].quantity = 0;
                }
            }
        });
        saveDataToLocalStorage('stock', stock);
    }

    orders.push(newOrder);
    orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
    showToast("Order saved successfully!");
    renderPage('allOrders');
});

// --- Stock Management ---
function renderStock() {
    updateStockFormVisibility();
    const mode = getIndustryMode();
    const stockTableBody = document.getElementById('stock-table-body');
    stockTableBody.innerHTML = '';

    if (stock.length === 0) {
        stockTableBody.innerHTML = `
            <tr class="border-t" style="border-color: var(--border-color);">
                <td colspan="4" class="p-8 text-center" style="color: var(--text-secondary);">No stock items yet. Add one above!</td>
            </tr>
        `;
    } else {
        stock.forEach(item => {
            const row = document.createElement('tr');
            row.className = "border-t transition-colors";
            row.style.borderColor = 'var(--border-color)';
            row.onmouseover = function() { this.style.backgroundColor = 'var(--bg-tertiary)'; };
            row.onmouseout = function() { this.style.backgroundColor = 'var(--bg-secondary)'; };
            row.dataset.stockId = item.id;

            if (item.isEditing) {
                const showExtraFields = mode === 'medical' || mode === 'grocery';
                const showHighRisk = mode === 'medical';
                row.innerHTML = `
                    <td class="p-8">
                        <input type="text" data-field="name" value="${item.name}"
                            class="block w-full px-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all" />
                        ${showExtraFields ? `
                            <div class="mt-2 space-y-1">
                                <label class="text-[10px] font-black uppercase" style="color: var(--text-tertiary);">Expiry Date</label>
                                <input type="date" data-field="expiryDate" value="${item.expiryDate || ''}"
                                    class="block w-full px-4 py-2 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all" />
                            </div>
                        ` : ''}
                        ${showHighRisk ? `
                            <div class="flex items-center gap-2 mt-2 p-2 rounded-xl" style="background-color:rgba(239,68,68,0.07);">
                                <input type="checkbox" data-field="isHighRisk" ${item.isHighRisk ? 'checked' : ''} class="h-4 w-4" style="accent-color:#ef4444;">
                                <label class="text-xs font-bold" style="color:#dc2626;">⚠️ High Risk Medicine</label>
                            </div>
                        ` : ''}
                    </td>
                    <td class="p-8">
                        <input type="number" data-field="price" value="${item.price}" step="0.01" min="0"
                            class="block w-full px-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all" />
                    </td>
                    <td class="p-8">
                        <input type="number" data-field="quantity" value="${item.quantity}" step="1" min="0"
                            class="block w-full px-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all" />
                    </td>
                    <td class="p-8 text-right">
                        <div class="flex gap-2 justify-end">
                            <button onclick="saveEditedStockItem('${item.id}')" class="bg-black text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-colors">Save</button>
                            <button onclick="cancelEditStockItem('${item.id}')" class="bg-gray-400 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-500 transition-colors">Cancel</button>
                        </div>
                    </td>
                `;
            } else {
                const isLowStock = item.quantity <= 5;

                // Build expiry/freshness badge
                let expiryBadgeHtml = '';
                if ((mode === 'medical' || mode === 'grocery') && item.expiryDate) {
                    const expDate = new Date(item.expiryDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((expDate - today) / 86400000);
                    if (diffDays < 0) {
                        expiryBadgeHtml = `<span class="expiry-badge expired">⛔ Expired ${Math.abs(diffDays)} days ago</span>`;
                    } else if (diffDays <= 30) {
                        expiryBadgeHtml = `<span class="expiry-badge warn">⚠️ Expires in ${diffDays}d</span>`;
                    } else {
                        expiryBadgeHtml = `<span class="expiry-badge ok">✅ Expires ${expDate.toLocaleDateString()}</span>`;
                    }
                } else if (mode === 'grocery' && item.dateAdded) {
                    const addedDays = Math.floor((Date.now() - new Date(item.dateAdded)) / 86400000);
                    expiryBadgeHtml = `<span class="expiry-badge grocery">🗓 Added ${addedDays} day${addedDays !== 1 ? 's' : ''} ago</span>`;
                }

                // High-risk caution badge (medical only)
                const cautionBadgeHtml = (mode === 'medical' && item.isHighRisk)
                    ? `<span class="caution-badge"><i class="material-icons" style="font-size:0.85rem;">warning</i>HIGH RISK</span>`
                    : '';

                row.innerHTML = `
                    <td class="p-8 font-black text-sm">
                        <div>${item.name}${cautionBadgeHtml}</div>
                        ${expiryBadgeHtml ? `<div>${expiryBadgeHtml}</div>` : ''}
                    </td>
                    <td class="p-8 font-bold text-gray-500">₹${item.price.toFixed(2)}</td>
                    <td class="p-8">
                        <span class="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${isLowStock ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}">
                            ${item.quantity} units
                        </span>
                    </td>
                    <td class="p-8">
                        <div class="flex flex-col items-start gap-2">
                            <svg class="barcode-svg" style="max-width:200px;"></svg>
                            <button onclick="generateBarcode('${item.id}')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1 mt-1">
                                <i class="material-icons text-sm">download</i> Download
                            </button>
                        </div>
                    </td>
                    <td class="p-8 text-right">
                        <div class="flex gap-2 justify-end">
                            <button onclick="editStockItem('${item.id}')" class="bg-gray-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-700 transition-colors">Edit</button>
                            <button onclick="deleteStockItem('${item.id}')" class="bg-red-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-red-700 transition-colors">Delete</button>
                        </div>
                    </td>
                `;
                if (item.barcode) {
                    const svgEl = row.querySelector('.barcode-svg');
                    if (svgEl) {
                        try {
                            JsBarcode(svgEl, item.barcode.toString(), {
                                format: "CODE128",
                                width: 1.5,
                                height: 50,
                                displayValue: true,
                                fontSize: 10,
                                margin: 5
                            });
                        } catch(e) { console.log('Barcode render error:', e); }
                    }
                }
            }
            stockTableBody.appendChild(row);
        });
    }
}

document.getElementById('stock-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!userId) {
        showToast("User not authenticated. Please try again.");
        return;
    }

    const productName = document.getElementById('stockProductName').value.trim();
    const productPrice = parseFloat(document.getElementById('stockProductPrice').value);
    const productQuantity = parseInt(document.getElementById('stockProductQuantity').value);

    if (!productName) {
        showToast("Product name cannot be empty.");
        return;
    }
    if (isNaN(productPrice) || productPrice < 0) {
        showToast("Please enter a valid non-negative price.");
        return;
    }
    if (isNaN(productQuantity) || productQuantity < 0) {
        showToast("Please enter a valid non-negative quantity.");
        return;
    }

    const isDuplicate = stock.some(item => item.name.toLowerCase() === productName.toLowerCase());
    if (isDuplicate) {
        showToast("Product with this name already exists in stock.");
        return;
    }

    const newStockItem = {
        id: crypto.randomUUID(),
        barcode: generateBarcodeNumber(),
        name: productName,
        price: productPrice,
        quantity: productQuantity,
        isEditing: false,
        dateAdded: new Date().toISOString(),
        expiryDate: document.getElementById('stockExpiryDate')?.value || '',
        isHighRisk: document.getElementById('stockHighRisk')?.checked || false
    };

    stock.push(newStockItem);
    stock.sort((a, b) => a.name.localeCompare(b.name));
    saveDataToLocalStorage('stock', stock);
    showToast("Stock item added!");

    document.getElementById('stockProductName').value = '';
    document.getElementById('stockProductPrice').value = '';
    document.getElementById('stockProductQuantity').value = '';
    const expiryInput = document.getElementById('stockExpiryDate');
    if (expiryInput) expiryInput.value = '';
    const highRiskInput = document.getElementById('stockHighRisk');
    if (highRiskInput) highRiskInput.checked = false;
    renderStock();
});

function editStockItem(id) {
    const itemIndex = stock.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        stock[itemIndex].isEditing = true;
        renderStock();
    }
}

async function saveEditedStockItem(id) {
    const itemIndex = stock.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        const row = document.querySelector(`tr[data-stock-id="${id}"]`);
        const nameInput = row.querySelector('input[data-field="name"]');
        const priceInput = row.querySelector('input[data-field="price"]');
        const quantityInput = row.querySelector('input[data-field="quantity"]');
        const expiryInput = row.querySelector('input[data-field="expiryDate"]');
        const highRiskInput = row.querySelector('input[data-field="isHighRisk"]');

        const newName = nameInput.value.trim();
        const newPrice = parseFloat(priceInput.value);
        const newQuantity = parseInt(quantityInput.value);

        if (!newName) {
            showToast("Product name cannot be empty.");
            return;
        }
        if (isNaN(newPrice) || newPrice < 0) {
            showToast("Please enter a valid non-negative price.");
            return;
        }
        if (isNaN(newQuantity) || newQuantity < 0) {
            showToast("Please enter a valid non-negative quantity.");
            return;
        }

        const isDuplicate = stock.some(item => item.id !== id && item.name.toLowerCase() === newName.toLowerCase());
        if (isDuplicate) {
            showToast("Another product with this name already exists.");
            return;
        }

        stock[itemIndex].name = newName;
        stock[itemIndex].price = newPrice;
        stock[itemIndex].quantity = newQuantity;
        stock[itemIndex].isEditing = false;
        if (expiryInput != null) {
            stock[itemIndex].expiryDate = expiryInput.value || '';
        }
        if (highRiskInput != null) {
            stock[itemIndex].isHighRisk = highRiskInput.checked;
        }
        // Preserve barcode when editing
        if (!stock[itemIndex].barcode) {
            stock[itemIndex].barcode = generateBarcodeNumber();
        }
        stock.sort((a, b) => a.name.localeCompare(b.name));
        saveDataToLocalStorage('stock', stock);
        showToast("Stock item updated!");
        renderStock();
    }
}

function cancelEditStockItem(id) {
    const itemIndex = stock.findIndex(item => item.id === id);
    if (itemIndex > -1) {
        stock[itemIndex].isEditing = false;
        renderStock();
    }
}

async function deleteStockItem(id) {
    const confirmed = await showConfirmation("Are you sure you want to delete this stock item? This cannot be undone.");
    if (confirmed) {
        stock = stock.filter(item => item.id !== id);
        saveDataToLocalStorage('stock', stock);
        showToast("Stock item deleted!");
        renderStock();
    }
}

// --- Notes Management ---
function renderNotes() {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = '<p class="text-gray-600 col-span-3 text-center">No notes yet. Add one above!</p>';
    } else {
        notes.forEach(note => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'p-8 rounded-[2rem] border shadow-sm relative group';
            noteDiv.style.backgroundColor = 'var(--bg-secondary)';
            noteDiv.style.borderColor = 'var(--border-color)';
            noteDiv.dataset.noteId = note.id;

            if (note.isEditing) {
                noteDiv.innerHTML = `
                    <div class="mb-6">
                        <textarea data-note-id="${note.id}"
                            class="block w-full px-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all"
                            rows="3">${note.content}</textarea>
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button onclick="saveEditedNote('${note.id}')" class="bg-black text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-colors">Save</button>
                        <button onclick="cancelEditNote('${note.id}')" class="bg-gray-400 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-500 transition-colors">Cancel</button>
                    </div>
                `;
            } else {
                noteDiv.innerHTML = `
                    <button onclick="deleteNote('${note.id}')" class="absolute top-4 right-4 text-gray-200 group-hover:text-red-500 transition-colors">
                        <i class="material-icons">close</i>
                    </button>
                    <p class="text-gray-800 font-medium ${note.isDone ? 'line-through text-gray-500' : ''}">${note.content}</p>
                    <div class="flex items-center justify-between mt-6">
                        <p class="text-[10px] font-black uppercase text-gray-400">${new Date(note.createdAt).toLocaleDateString()}</p>
                        <div class="flex gap-2">
                            <label class="flex items-center text-sm text-gray-700">
                                <input type="checkbox" ${note.isDone ? 'checked' : ''} onchange="toggleNoteDone('${note.id}', ${note.isDone})" class="form-checkbox h-4 w-4 text-black rounded-md focus:ring-0 mr-1 transition-colors" />
                                Done
                            </label>
                            <button onclick="editNote('${note.id}')" class="bg-gray-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-700 transition-colors">Edit</button>
                        </div>
                    </div>
                `;
            }
            notesList.appendChild(noteDiv);
        });
    }
}

function addNote() {
    const newNoteContentInput = document.getElementById('new-note-content');

    if (!userId) {
        showToast("User not authenticated. Please try again.");
        return;
    }

    if (!newNoteContentInput.value.trim()) {
        showToast("Note content cannot be empty.");
        return;
    }

    const newNote = {
        id: crypto.randomUUID(),
        content: newNoteContentInput.value.trim(),
        createdAt: new Date(),
        isDone: false,
        isEditing: false
    };

    notes.push(newNote);
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    saveDataToLocalStorage('notes', notes);
    showToast("Note added!");
    newNoteContentInput.value = '';
    renderNotes();
}

function toggleNoteDone(noteId, currentStatus) {
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex > -1) {
        notes[noteIndex].isDone = !currentStatus;
        notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveDataToLocalStorage('notes', notes);
        showToast(`Note marked as ${!currentStatus ? 'done' : 'undone'}.`);
        renderNotes();
    }
}

async function deleteNote(noteId) {
    const confirmed = await showConfirmation("Are you sure you want to delete this note?");
    if (confirmed) {
        notes = notes.filter(note => note.id !== noteId);
        saveDataToLocalStorage('notes', notes);
        showToast("Note deleted!");
        renderNotes();
    }
}

function editNote(noteId) {
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex > -1) {
        notes[noteIndex].isEditing = true;
        renderNotes();
    }
}

function saveEditedNote(noteId) {
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex > -1) {
        const editedContent = document.querySelector(`textarea[data-note-id="${noteId}"]`).value.trim();
        if (!editedContent) {
            showToast("Note content cannot be empty.");
            return;
        }
        notes[noteIndex].content = editedContent;
        notes[noteIndex].isEditing = false;
        saveDataToLocalStorage('notes', notes);
        showToast("Note updated!");
        renderNotes();
    }
}

function cancelEditNote(noteId) {
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex > -1) {
        notes[noteIndex].isEditing = false;
        renderNotes();
    }
}

function createNewNote() {
    const newNoteContentInput = document.getElementById('new-note-content');
    newNoteContentInput.focus();
}

// --- All Orders Page Logic ---
function renderAllOrders() {
    const activeOrdersList = document.getElementById('active-orders-list');
    const completedOrdersList = document.getElementById('completed-orders-list');
    const clearCompletedOrdersBtn = document.getElementById('clear-completed-orders-btn');

    const searchTerm = document.getElementById('order-search-input').value.toLowerCase();

    const allOrdersCombined = [...orders, ...completedOrders];

    const displayedOrders = allOrdersCombined.filter(order => {
        const buyerNameMatch = order.buyerName.toLowerCase().includes(searchTerm);
        const orderDateFormatted = new Date(order.orderDate).toISOString().slice(0, 10);
        const dateMatch = orderDateFormatted.includes(searchTerm);
        return buyerNameMatch || dateMatch;
    });

    const activeFiltered = displayedOrders.filter(order => !order.isDelivered);
    const completedFiltered = displayedOrders.filter(order => order.isDelivered);

    activeOrdersList.innerHTML = '';
    completedOrdersList.innerHTML = '';

    if (activeFiltered.length === 0) {
        activeOrdersList.innerHTML = '<p class="text-gray-600">No active orders found. Start by adding a new order!</p>';
    } else {
        activeOrdersList.innerHTML = `
            <div class="overflow-x-auto rounded-[2rem] shadow-md mobile-table-container">
                <table class="min-w-full border" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
                    <thead style="background-color: var(--bg-tertiary);">
                        <tr>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400">Buyer Name</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400">Date</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Seen</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Delivered</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Actions</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Details</th>
                        </tr>
                    </thead>
                    <tbody id="active-orders-tbody"></tbody>
                </table>
            </div>
        `;
        const tbody = activeOrdersList.querySelector('#active-orders-tbody');
        activeFiltered.forEach(order => {
            tbody.innerHTML += createOrderRow(order);
        });
    }

    if (completedFiltered.length === 0) {
        completedOrdersList.innerHTML = '<p class="text-gray-600">No completed orders yet.</p>';
        clearCompletedOrdersBtn.classList.add('hidden');
    } else {
        completedOrdersList.innerHTML = `
            <div class="overflow-x-auto rounded-[2rem] shadow-md mobile-table-container">
                <table class="min-w-full border" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
                    <thead style="background-color: var(--bg-tertiary);">
                        <tr>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400">Buyer Name</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400">Date</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Actions</th>
                            <th class="p-8 text-[10px] font-black uppercase text-gray-400 text-center">Details</th>
                        </tr>
                    </thead>
                    <tbody id="completed-orders-tbody"></tbody>
                </table>
            </div>
        `;
        const tbody = completedOrdersList.querySelector('#completed-orders-tbody');
        completedFiltered.forEach(order => {
            tbody.innerHTML += createOrderRow(order, true);
        });
        clearCompletedOrdersBtn.classList.remove('hidden');
    }

    attachOrderEventListeners();
}

function createOrderRow(order, isCompleted = false) {
    const orderDate = new Date(order.orderDate);
    const isExpanded = order.isExpanded || false;
    const isEditing = order.isEditing || false;

    let actionsHtml = '';
    let buyerNameCellContent;
    let itemsDetailsHtml = '';

    if (isCompleted) {
        actionsHtml = `
            <button onclick="handlePrintBill('${order.id}', 'photo')" class="bg-black text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                <i class="material-icons">download</i> Download
            </button>
            <button onclick="handlePrintBill('${order.id}', 'print')" class="bg-gray-100 px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2" style="background-color:var(--bg-tertiary);color:var(--text-primary);">
                <i class="material-icons">print</i> Print
            </button>
            <button onclick="handleToggleDelivered('${order.id}', true)" class="bg-gray-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                <i class="material-icons">unarchive</i> Move to Active
            </button>
        `;
        buyerNameCellContent = order.buyerName;
        itemsDetailsHtml = order.items.map(item => `
            <tr class="border-t" style="border-color: var(--border-color);">
                <td class="p-6" style="color: var(--text-primary);">${item.product}</td>
                <td class="p-6" style="color: var(--text-primary);">${item.quantity}</td>
                <td class="p-6" style="color: var(--text-primary);">₹${item.pricePerUnit.toFixed(2)}</td>
                <td class="p-6 text-right" style="color: var(--text-primary);">₹${item.total.toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        if (isEditing) {
            buyerNameCellContent = `
                <input type="text" value="${order.buyerName}" data-order-field="buyerName"
                    class="block w-full px-4 py-3 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all"
                    style="background-color: var(--input-bg); color: var(--text-primary);" />
            `;
            actionsHtml = `
                <button onclick="handleSaveEditedOrder('${order.id}')" class="bg-black text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <i class="material-icons">save</i> Save
                </button>
                <button onclick="handleCancelEditOrder('${order.id}')" class="bg-gray-400 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-500 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <i class="material-icons">cancel</i> Cancel
                </button>
            `;
            itemsDetailsHtml = order.items.map((item, itemIndex) => `
                <tr class="border-t" style="border-color: var(--border-color);" data-item-index="${itemIndex}">
                    <td class="p-6">
                        <input type="text" value="${item.product}" data-item-field="product"
                            class="block w-full px-4 py-3 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all"
                            style="background-color: var(--input-bg); color: var(--text-primary);" />
                    </td>
                    <td class="p-6">
                        <input type="number" value="${item.quantity || ''}" data-item-field="quantity" step="1" min="1"
                            class="block w-full px-4 py-3 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all"
                            style="background-color: var(--input-bg); color: var(--text-primary);" required />
                    </td>
                    <td class="p-6">
                        <input type="number" value="${item.pricePerUnit}" data-item-field="pricePerUnit" step="0.01" min="0"
                            class="block w-full px-4 py-3 rounded-2xl border-none outline-none focus:ring-2 focus:ring-black transition-all"
                            style="background-color: var(--input-bg); color: var(--text-primary);" />
                    </td>
                    <td class="p-6 text-right text-lg">₹<span class="edited-item-total">${item.total.toFixed(2)}</span></td>
                    <td class="p-6 text-center">
                        <button onclick="handleRemoveOrderItem('${order.id}', ${itemIndex})" class="text-red-400 hover:text-red-600 text-xl font-bold transition-colors">
                            <i class="material-icons">delete</i>
                        </button>
                    </td>
                </tr>
            `).join('') + `
            <tr>
                <td colspan="5" class="p-6 text-center">
                    <button onclick="handleAddOrderItem('${order.id}')" class="bg-gray-200 text-gray-700 px-6 py-3 rounded-2xl text-sm hover:bg-gray-300 transition-colors flex items-center justify-center gap-2">
                        <i class="material-icons">add_circle_outline</i> Add Item Row
                    </button>
                </td>
            </tr>
            `;
        } else {
            actionsHtml = `
                <button onclick="handlePrintBill('${order.id}', 'photo')" class="bg-black text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <i class="material-icons">download</i> Download
                </button>
                <button onclick="handlePrintBill('${order.id}', 'print')" class="bg-gray-100 px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2" style="background-color:var(--bg-tertiary);color:var(--text-primary);">
                    <i class="material-icons">print</i> Print
                </button>
                <button onclick="handleEditOrder('${order.id}')" class="bg-gray-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <i class="material-icons">edit</i> Edit
                </button>
            `;
            buyerNameCellContent = order.buyerName;
            itemsDetailsHtml = order.items.map(item => `
                <tr class="border-t" style="border-color: var(--border-color);">
                    <td class="p-6" style="color: var(--text-primary);">${item.product}</td>
                    <td class="p-6" style="color: var(--text-primary);">${item.quantity}</td>
                    <td class="p-6" style="color: var(--text-primary);">₹${item.pricePerUnit.toFixed(2)}</td>
                    <td class="p-6 text-right" style="color: var(--text-primary);">₹${item.total.toFixed(2)}</td>
                </tr>
            `).join('');
        }
    }

    return `
        <tr class="border-t transition-colors" style="border-color: var(--border-color);" onmouseover="this.style.backgroundColor='var(--bg-tertiary)'" onmouseout="this.style.backgroundColor='var(--bg-secondary)'">
            <td class="p-8 font-black text-sm">${buyerNameCellContent}</td>
            <td class="p-8 text-sm">${orderDate.toLocaleDateString()}</td>
            ${!isCompleted && !isEditing ? `
            <td class="p-8 text-center">
                <input type="checkbox" ${order.isSeen ? 'checked' : ''} onchange="handleToggleSeen('${order.id}', ${order.isSeen})" class="form-checkbox h-5 w-5 text-black rounded-md focus:ring-0 transition-colors" />
            </td>
            <td class="p-8 text-center">
                <input type="checkbox" ${order.isDelivered ? 'checked' : ''} onchange="handleToggleDelivered('${order.id}', ${order.isDelivered})" class="form-checkbox h-5 w-5 text-black rounded-md focus:ring-0 transition-colors" />
            </td>
            ` : isEditing ? `<td colspan="2"></td>` : ''}
            <td class="p-8 text-center">
                <div class="flex gap-2 justify-center">
                    ${actionsHtml}
                </div>
            </td>
            <td class="p-8 text-center">
                <button onclick="handleToggleExpand('${order.id}')" class="text-gray-400 hover:text-black transition-colors p-2">
                    <i class="material-icons transform ${isExpanded ? 'rotate-180' : 'rotate-0'} transition-transform">expand_more</i>
                </button>
            </td>
        </tr>
        ${isExpanded ? `
        <tr>
            <td colspan="${isCompleted || isEditing ? '5' : '7'}" class="p-8 border-t" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">
                <h4 class="font-black text-lg mb-4">Bill Details for ${order.buyerName}:</h4>
                <div class="overflow-x-auto mobile-table-container">
                    <table class="min-w-full border rounded-[2rem]" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
                        <thead>
                            <tr style="background-color: var(--bg-tertiary);">
                                <th class="p-6 text-left text-sm font-black uppercase">Product</th>
                                <th class="p-6 text-left text-sm font-black uppercase">Qty</th>
                                <th class="p-6 text-left text-sm font-black uppercase">Price/Unit</th>
                                <th class="p-6 text-right text-sm font-black uppercase">Total</th>
                                ${isEditing ? '<th class="p-6 text-center text-sm font-black uppercase"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="order-items-tbody-${order.id}">
                            ${itemsDetailsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="text-right font-black text-2xl mt-6 pr-6">
                    Grand Total: ₹<span id="order-grand-total-${order.id}">${order.grandTotal.toFixed(2)}</span>
                </div>
            </td>
        </tr>
        ` : ''}
    `;
}

function attachOrderEventListeners() {
    document.querySelectorAll('input[data-order-field], input[data-item-field]').forEach(input => {
        input.oninput = (e) => {
            let orderId;
            const closestRow = e.target.closest('tr');
            if (closestRow && closestRow.dataset.orderId) {
                orderId = closestRow.dataset.orderId;
            } else {
                const detailRow = e.target.closest('tr');
                const tbodyId = detailRow.parentNode.id;
                if (tbodyId && tbodyId.startsWith('order-items-tbody-')) {
                    orderId = tbodyId.replace('order-items-tbody-', '');
                }
            }

            if (!orderId) {
                console.error("Could not determine orderId for input:", e.target);
                return;
            }

            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) return;

            const field = e.target.dataset.orderField || e.target.dataset.itemField;
            let value = e.target.value;

            if (field === 'quantity' || field === 'pricePerUnit') {
                value = value === '' ? '' : parseFloat(value);
            }

            if (e.target.dataset.orderField) {
                orders[orderIndex][field] = value;
            } else if (e.target.dataset.itemField) {
                const itemIndex = parseInt(e.target.closest('tr').dataset.itemIndex);
                orders[orderIndex].items[itemIndex][field] = (field === 'product') ? value : parseFloat(value);

                const qty = orders[orderIndex].items[itemIndex].quantity;
                const price = orders[orderIndex].items[itemIndex].pricePerUnit;
                orders[orderIndex].items[itemIndex].total = (isNaN(qty) || qty === '' ? 0 : qty) * (isNaN(price) || price === '' ? 0 : price);

                e.target.closest('tr').querySelector('.edited-item-total').textContent = orders[orderIndex].items[itemIndex].total.toFixed(2);
                calculateOrderGrandTotal(orderId);
            }
        };

        if (input.dataset.itemField === 'product') {
            input.addEventListener('change', (e) => {
                let orderId;
                const detailRow = e.target.closest('tr');
                const tbodyId = detailRow.parentNode.id;
                if (tbodyId && tbodyId.startsWith('order-items-tbody-')) {
                    orderId = tbodyId.replace('order-items-tbody-', '');
                }

                if (!orderId) {
                    console.error("Could not determine orderId for product change input:", e.target);
                    return;
                }

                const orderIndex = orders.findIndex(o => o.id === orderId);
                if (orderIndex === -1) return;

                const itemIndex = parseInt(e.target.closest('tr').dataset.itemIndex);
                const productName = e.target.value.trim();
                const stockItem = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());

                if (stockItem) {
                    orders[orderIndex].items[itemIndex].pricePerUnit = parseFloat(stockItem.price);
                    const qty = orders[orderIndex].items[itemIndex].quantity;
                    const price = orders[orderIndex].items[itemIndex].pricePerUnit;
                    orders[orderIndex].items[itemIndex].total = (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price);
                    renderAllOrders();
                }
            });
        }
    });
}

// Order management functions
window.handleToggleExpand = (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId) || completedOrders.find(o => o.id === orderId);
    if (targetOrder) {
        targetOrder.isExpanded = !targetOrder.isExpanded;
        renderAllOrders();
    }
};

window.handleToggleSeen = (orderId, currentStatus) => {
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex > -1) {
        orders[orderIndex].isSeen = !currentStatus;
        saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
        showToast(`Order ${orderId} marked as ${!currentStatus ? 'seen' : 'unseen'}.`);
        renderAllOrders();
    }
};

window.handleToggleDelivered = (orderId, currentStatus) => {
    const orderToMove = orders.find(order => order.id === orderId) || completedOrders.find(o => o.id === orderId);
    if (!orderToMove) return;

    const newStatus = !currentStatus;
    const updatedOrder = {
        ...orderToMove,
        isDelivered: newStatus,
        isEditing: false
    };

    if (newStatus) {
        orders = orders.filter(order => order.id !== orderId);
        completedOrders.push(updatedOrder);
        completedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    } else {
        completedOrders = completedOrders.filter(order => order.id !== orderId);
        orders.push(updatedOrder);
        orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }
    saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
    showToast(`Order ${orderToMove.buyerName} marked as ${newStatus ? 'delivered' : 'active'}.`);
    renderAllOrders();
};

window.handleEditOrder = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order._originalState = JSON.parse(JSON.stringify(order));
        order.isEditing = true;
        order.isExpanded = true;
        renderAllOrders();
        attachOrderEventListeners();
    }
};

window.handleSaveEditedOrder = (orderId) => {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const buyerNameInput = document.querySelector(`input[data-order-field="buyerName"]`);
    if (!buyerNameInput) {
        showToast("Could not find buyer name input. Please try again.");
        return;
    }

    const newBuyerName = buyerNameInput.value.trim();
    if (!newBuyerName) {
        showToast("Buyer name cannot be empty.");
        return;
    }

    const newItems = [];
    let isValid = true;
    const itemsTableBody = document.getElementById(`order-items-tbody-${orderId}`);
    if (!itemsTableBody) {
        showToast("Could not find order items table. Please try again.");
        return;
    }

    itemsTableBody.querySelectorAll('tr[data-item-index]').forEach(row => {
        const productInput = row.querySelector('input[data-item-field="product"]');
        const quantityInput = row.querySelector('input[data-item-field="quantity"]');
        const priceInput = row.querySelector('input[data-item-field="pricePerUnit"]');

        const product = productInput.value.trim();
        const quantity = quantityInput.value === '' ? '' : parseFloat(quantityInput.value);
        const pricePerUnit = priceInput.value === '' ? '' : parseFloat(priceInput.value);
        const total = (isNaN(quantity) || quantity === '' ? 0 : quantity) * (isNaN(pricePerUnit) || pricePerUnit === '' ? 0 : pricePerUnit);

        if (!product) {
            showToast("Product name cannot be empty for an item.");
            isValid = false;
            return;
        }
        if (isNaN(quantity) || quantity <= 0) {
            showToast(`Quantity for product "${product}" must be a positive number.`);
            isValid = false;
            return;
        }
        if (isNaN(pricePerUnit) || pricePerUnit < 0) {
            showToast(`Price per unit for product "${product}" must be a non-negative number.`);
            isValid = false;
            return;
        }

        newItems.push({
            product,
            quantity,
            pricePerUnit,
            total
        });
    });

    if (!isValid) {
        return;
    }

    if (newItems.length === 0) {
        showToast("Bill must contain at least one product.");
        return;
    }

    order.buyerName = newBuyerName;
    order.items = newItems;
    calculateOrderGrandTotal(orderId);
    order.isEditing = false;
    delete order._originalState;

    saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
    showToast("Order updated successfully!");
    renderAllOrders();
};

window.handleCancelEditOrder = (orderId) => {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    if (order._originalState) {
        orders[orderIndex] = JSON.parse(JSON.stringify(order._originalState));
    }
    orders[orderIndex].isEditing = false;
    delete orders[orderIndex]._originalState;
    showToast("Order edit cancelled.");
    renderAllOrders();
};

window.handleAddOrderItem = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.items.push({
            product: '',
            quantity: '',
            pricePerUnit: 0,
            total: 0
        });
        renderAllOrders();
    }
};

window.handleRemoveOrderItem = (orderId, itemIndex) => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.items.length > 1) {
        order.items.splice(itemIndex, 1);
        calculateOrderGrandTotal(orderId);
        renderAllOrders();
    } else if (order.items.length <= 1) {
        showToast("An order must have at least one product.");
    }
};

window.calculateOrderGrandTotal = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        const total = order.items.reduce((sum, item) => sum + (isNaN(item.total) ? 0 : item.total), 0);
        order.grandTotal = total;
        const grandTotalElement = document.getElementById(`order-grand-total-${orderId}`);
        if (grandTotalElement) {
            grandTotalElement.textContent = total.toFixed(2);
        }
    }
};

// --- Bill Printing ---
const loadScript = (url) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${url}`);
            reject(new Error(`Failed to load library from ${url}. Please check network or browser extensions.`));
        };
        document.head.appendChild(script);
    });
};

window.handlePrintBill = async (orderId, format) => {
    const order = orders.find(o => o.id === orderId) || completedOrders.find(o => o.id === orderId);
    if (!order) {
        showToast("Order not found.");
        return;
    }

    // html2canvas is only needed for PNG download, not for print
    if (format === 'photo' && typeof window.html2canvas === 'undefined') {
        showToast("Loading export library…");
        try {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
        } catch (error) {
            showToast(`❌ Export library unavailable: ${error.message}`);
            return;
        }
    }

    const billToPrintDiv = document.getElementById('bill-to-print');
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const billNotes   = companyDetails.defaultBillNotes || '';
    const invoiceNo   = (order.id || '').toString().slice(-8).toUpperCase();
    const invoiceDate = new Date(order.orderDate).toLocaleDateString(undefined, dateOptions);
    const invoiceTime = new Date(order.orderDate).toLocaleTimeString(undefined, timeOptions);
    const co          = companyDetails;

    billToPrintDiv.innerHTML = `
    <div style="width:210mm;min-height:297mm;box-sizing:border-box;background:#ffffff;font-family:'Inter',system-ui,sans-serif;color:#1e293b;font-size:13px;line-height:1.5;">

      <!-- ── Top header bar ── -->
      <div style="background:#0f172a;padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;margin-bottom:4px;">
            ${co.companyName || 'QuickBill Pro'}
          </div>
          ${co.address ? `<div style="color:#94a3b8;font-size:11.5px;margin-top:2px;">${co.address}</div>` : ''}
          ${co.phone   ? `<div style="color:#94a3b8;font-size:11.5px;">Tel: ${co.phone}</div>` : ''}
          ${co.email   ? `<div style="color:#94a3b8;font-size:11.5px;">${co.email}</div>` : ''}
          ${co.gstNumber ? `<div style="color:#cbd5e1;font-size:11.5px;font-weight:600;margin-top:4px;">GSTIN: ${co.gstNumber}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">Invoice</div>
          <div style="color:#94a3b8;font-size:11.5px;margin-top:6px;">#${invoiceNo}</div>
        </div>
      </div>

      <!-- ── Invoice meta row ── -->
      <div style="display:flex;border-bottom:1px solid #e2e8f0;">
        <!-- Bill To -->
        <div style="flex:1;padding:20px 36px;border-right:1px solid #e2e8f0;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:6px;">Bill To</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;">${order.buyerName}</div>
        </div>
        <!-- Invoice details -->
        <div style="padding:20px 36px;min-width:200px;">
          <table style="border:none;border-collapse:collapse;width:100%;font-size:12px;">
            <tr>
              <td style="color:#64748b;padding:2px 0;padding-right:16px;white-space:nowrap;">Invoice Date</td>
              <td style="color:#0f172a;font-weight:600;text-align:right;">${invoiceDate}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:2px 0;padding-right:16px;white-space:nowrap;">Time</td>
              <td style="color:#0f172a;font-weight:600;text-align:right;">${invoiceTime}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:2px 0;padding-right:16px;white-space:nowrap;">Invoice No.</td>
              <td style="color:#0f172a;font-weight:700;text-align:right;">#${invoiceNo}</td>
            </tr>
            ${co.gstNumber ? `
            <tr>
              <td style="color:#64748b;padding:2px 0;padding-right:16px;white-space:nowrap;">GSTIN</td>
              <td style="color:#0f172a;font-weight:600;text-align:right;">${co.gstNumber}</td>
            </tr>` : ''}
          </table>
        </div>
      </div>

      <!-- ── Items table ── -->
      <div style="padding:0 36px;">
        <table style="width:100%;border-collapse:collapse;margin-top:24px;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:11px 14px;text-align:left;font-size:10px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.08em;border-radius:0;">#</th>
              <th style="padding:11px 14px;text-align:left;font-size:10px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.08em;">Item / Description</th>
              <th style="padding:11px 14px;text-align:center;font-size:10px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.08em;">Qty</th>
              <th style="padding:11px 14px;text-align:right;font-size:10px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.08em;">Unit Price</th>
              <th style="padding:11px 14px;text-align:right;font-size:10px;font-weight:700;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.08em;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item, i) => `
              <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding:11px 14px;color:#94a3b8;font-size:12px;border-bottom:1px solid #f1f5f9;">${i + 1}</td>
                <td style="padding:11px 14px;font-weight:500;color:#0f172a;font-size:13px;border-bottom:1px solid #f1f5f9;">${item.product}</td>
                <td style="padding:11px 14px;text-align:center;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9;">${item.quantity}</td>
                <td style="padding:11px 14px;text-align:right;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9;">₹${item.pricePerUnit.toFixed(2)}</td>
                <td style="padding:11px 14px;text-align:right;font-weight:600;color:#0f172a;font-size:13px;border-bottom:1px solid #f1f5f9;">₹${item.total.toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- ── Totals ── -->
      <div style="display:flex;justify-content:flex-end;padding:0 36px;margin-top:8px;">
        <table style="border-collapse:collapse;min-width:240px;font-size:13px;">
          <tr>
            <td style="padding:6px 14px 6px 0;color:#64748b;text-align:right;">Subtotal</td>
            <td style="padding:6px 0 6px 24px;text-align:right;color:#0f172a;font-weight:500;">₹${order.grandTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:4px 0;">
              <div style="border-top:1px solid #e2e8f0;margin:4px 0;"></div>
            </td>
          </tr>
          <tr style="background:#0f172a;">
            <td style="padding:12px 14px 12px 16px;color:#e2e8f0;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;text-align:right;border-radius:4px 0 0 4px;">Total Due</td>
            <td style="padding:12px 16px 12px 24px;text-align:right;color:#ffffff;font-weight:800;font-size:17px;border-radius:0 4px 4px 0;">₹${order.grandTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${billNotes ? `
      <!-- ── Notes ── -->
      <div style="margin:24px 36px 0;padding:16px 20px;background:#f8fafc;border-left:3px solid #0f172a;border-radius:0 6px 6px 0;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:6px;">Notes</div>
        <div style="color:#374151;font-size:12.5px;line-height:1.7;">${billNotes}</div>
      </div>` : ''}

      <!-- ── Footer ── -->
      <div style="margin:32px 36px 0;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:#94a3b8;">
          ${co.companyName ? `<strong style="color:#475569;">${co.companyName}</strong>${co.phone ? ` &nbsp;·&nbsp; ${co.phone}` : ''}${co.email ? ` &nbsp;·&nbsp; ${co.email}` : ''}` : ''}
        </div>
        <div style="font-size:11px;color:#cbd5e1;">Generated with QuickBill Pro</div>
      </div>
      <div style="text-align:center;padding:18px 36px 28px;font-size:12px;color:#64748b;font-style:italic;">
        Thank you for your business!
      </div>

    </div>
    `;

    if (format === 'print') {
        // Use browser native print — no html2canvas needed
        window.addEventListener('afterprint', () => {
            billToPrintDiv.innerHTML = '';
        }, { once: true });
        window.print();
        return;
    }

    // PNG download via html2canvas
    billToPrintDiv.classList.add('visible-for-capture');
    setTimeout(async () => {
        try {
            const canvas = await window.html2canvas(billToPrintDiv.firstElementChild, {
                scale: 2,
                useCORS: true,
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `${order.buyerName}_Bill_${new Date(order.orderDate).toLocaleDateString().replace(/\//g, '-')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("✅ Bill downloaded!");
        } catch (error) {
            console.error("Error generating bill:", error);
            showToast("❌ Failed to generate bill. Please try again.");
        } finally {
            billToPrintDiv.classList.remove('visible-for-capture');
            billToPrintDiv.innerHTML = '';
        }
    }, 50);
};

// --- Barcode Generation ---
window.generateBarcode = (stockId) => {
    const item = stock.find(s => s.id === stockId);
    if (!item) {
        showToast("Stock item not found.");
        return;
    }

    // Ensure item has a barcode
    if (!item.barcode) {
        item.barcode = generateBarcodeNumber();
        saveDataToLocalStorage('stock', stock);
    }

    // Create a canvas for barcode
    const canvas = document.createElement('canvas');

    try {
        // Generate barcode using the numeric barcode ID
        JsBarcode(canvas, item.barcode, {
            format: "CODE128",
            width: 2,
            height: 100,
            displayValue: true,
            fontSize: 16,
            margin: 10,
            text: `${item.name} - ${item.barcode}`
        });

        // Convert canvas to image and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `barcode_${item.name.replace(/\s+/g, '_')}_${item.barcode}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast(`Barcode for "${item.name}" downloaded! ID: ${item.barcode}`);
        });
    } catch (error) {
        console.error('Barcode generation error:', error);
        showToast("Failed to generate barcode. Please try again.");
    }
};

// --- Firebase Authentication UI Functions ---
function updateAuthUI(user) {
    const demoMode = document.getElementById('auth-demo-mode');
    const loggedInMode = document.getElementById('auth-logged-in');
    const userEmailEl = document.getElementById('auth-user-email');

    if (!user || user.isAnonymous) {
        // Show demo mode
        demoMode?.classList.remove('hidden');
        loggedInMode?.classList.add('hidden');
    } else {
        // Show logged in mode
        demoMode?.classList.add('hidden');
        loggedInMode?.classList.remove('hidden');
        if (userEmailEl) {
            userEmailEl.textContent = user.email || 'Signed in';
        }
    }
}

window.updateAuthUI = updateAuthUI;

function switchAuthTab(tab) {
    const emailForm = document.getElementById('email-signin-form');
    const emailTab = document.getElementById('tab-email');

    if (tab === 'email') {
        emailForm?.classList.remove('hidden');
        emailTab?.style.setProperty('background-color', 'var(--bg-secondary)');
        emailTab?.style.setProperty('color', 'var(--text-primary)');
    }
}

window.switchAuthTab = switchAuthTab;

async function handleEmailSignIn(event) {
    if (event) event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        showToast('Please enter email and password');
        return;
    }

    if (!isValidEmailDomain(email)) {
        showToast('❌ Please enter a valid email address');
        return;
    }

    document.getElementById('resend-verification-section')?.classList.add('hidden');
    showToast('Signing in...');
    const result = await window.firebaseSignInWithEmail(email, password);

    if (result.success) {
        showToast('✅ Signed in successfully!');
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        document.getElementById('password-requirements')?.classList.add('hidden');
        document.getElementById('resend-verification-section')?.classList.add('hidden');
    } else {
        if (result.error === 'email-not-verified') {
            showToast('❌ Please verify your email first. Check your inbox.');
            document.getElementById('resend-verification-section')?.classList.remove('hidden');
        } else if (result.error.includes('user-not-found')) {
            showToast('❌ No account found with this email. Try signing up first.');
        } else if (result.error.includes('wrong-password') || result.error.includes('invalid-credential')) {
            showToast('❌ Incorrect password. Try again or use "Forgot Password".');
        } else if (result.error.includes('invalid-email')) {
            showToast('❌ Invalid email address format');
        } else if (result.error.includes('user-disabled')) {
            showToast('❌ This account has been disabled');
        } else if (result.error.includes('too-many-requests')) {
            showToast('❌ Too many failed attempts. Try again later or reset your password.');
        } else {
            showToast('❌ Sign in failed: ' + result.error);
        }
    }
}

window.handleEmailSignIn = handleEmailSignIn;

async function handleEmailSignUp() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        showToast('Please enter email and password');
        return;
    }

    if (!isValidEmailDomain(email)) {
        showToast('❌ Please enter a valid email address with a real domain');
        return;
    }

    // Validate password requirements
    const requirements = validatePassword(password);

    if (!requirements.length) {
        showToast('❌ Password must be at least 6 characters');
        return;
    }

    if (!requirements.letter) {
        showToast('❌ Password must contain at least one letter');
        return;
    }

    if (!requirements.number) {
        showToast('❌ Password must contain at least one number');
        return;
    }

    showToast('Creating account...');
    // Hint password managers that this is a new password
    const authPwField = document.getElementById('auth-password');
    if (authPwField) authPwField.setAttribute('autocomplete', 'new-password');
    const result = await window.firebaseSignUpWithEmail(email, password);
    if (authPwField) authPwField.setAttribute('autocomplete', 'current-password');

    if (result.success) {
        // Offer to save credentials via Credential Management API (Chrome/Edge/Opera)
        if (window.PasswordCredential) {
            try {
                const cred = new window.PasswordCredential({ id: email, password });
                await navigator.credentials.store(cred);
            } catch (credErr) { console.debug('PasswordCredential store failed:', credErr); }
        }
        showToast('✅ Account created! Check your email for a verification link before signing in.');
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        document.getElementById('password-requirements')?.classList.add('hidden');
        document.getElementById('resend-verification-section')?.classList.add('hidden');
    } else {
        if (result.error.includes('email-already-in-use')) {
            showToast('❌ This email is already registered. Try signing in or resetting your password.');
        } else if (result.error.includes('invalid-email')) {
            showToast('❌ Invalid email address format');
        } else if (result.error.includes('weak-password')) {
            showToast('❌ Password is too weak. Use a stronger password.');
        } else {
            showToast('❌ Sign up failed: ' + result.error);
        }
    }
}

window.handleEmailSignUp = handleEmailSignUp;

function toggleResetForm(formId, emailInputId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const wasHidden = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    if (!wasHidden && emailInputId) {
        const input = document.getElementById(emailInputId);
        if (input) input.value = '';
    }
}

async function sendPasswordReset(emailInputId, formId) {
    const email = document.getElementById(emailInputId)?.value.trim();
    if (!email) {
        showToast('Please enter your email address');
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address');
        return;
    }
    showToast('Sending password reset email...');
    const result = await window.firebaseResetPassword(email);
    if (result.success) {
        showToast('✅ Password reset email sent! Check your inbox.');
        toggleResetForm(formId, emailInputId);
    } else {
        if (result.error.includes('user-not-found')) {
            showToast('❌ No account found with this email address');
        } else if (result.error.includes('invalid-email')) {
            showToast('❌ Invalid email address');
        } else if (result.error.includes('too-many-requests')) {
            showToast('❌ Too many attempts. Please try again later.');
        } else {
            showToast('❌ Failed to send reset email: ' + result.error);
        }
    }
}

function toggleForgotPassword() {
    toggleResetForm('forgot-password-form', 'reset-email');
}

window.toggleForgotPassword = toggleForgotPassword;

async function handlePasswordReset() {
    await sendPasswordReset('reset-email', 'forgot-password-form');
}

window.handlePasswordReset = handlePasswordReset;

async function handleResendVerification() {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) {
        showToast('Enter your email and password above to resend the verification link');
        return;
    }
    showToast('Sending verification email...');
    const result = await window.firebaseResendVerificationEmail(email, password);
    if (result.success) {
        if (result.alreadyVerified) {
            showToast('✅ Email already verified — try signing in again!');
            document.getElementById('resend-verification-section')?.classList.add('hidden');
        } else {
            showToast('✅ Verification email resent! Check your inbox.');
        }
    } else {
        showToast('❌ Could not resend: ' + cleanFirebaseError(result.error));
    }
}

window.handleResendVerification = handleResendVerification;

function obToggleForgotPassword() {
    toggleResetForm('ob-forgot-password-form', 'ob-reset-email');
}

async function obHandlePasswordReset() {
    await sendPasswordReset('ob-reset-email', 'ob-forgot-password-form');
}

window.obToggleForgotPassword = obToggleForgotPassword;
window.obHandlePasswordReset = obHandlePasswordReset;

function wbToggleForgotPassword() {
    toggleResetForm('wb-forgot-password-form', 'wb-reset-email');
}

async function wbHandlePasswordReset() {
    await sendPasswordReset('wb-reset-email', 'wb-forgot-password-form');
}

window.wbToggleForgotPassword = wbToggleForgotPassword;
window.wbHandlePasswordReset = wbHandlePasswordReset;

// Password validation with visual feedback
function validatePassword(password) {
    const requirements = {
        length: password.length >= 6,
        letter: /[a-zA-Z]/.test(password),
        number: /[0-9]/.test(password)
    };

    return requirements;
}

function updatePasswordRequirements(password) {
    const reqDiv = document.getElementById('password-requirements');
    if (!reqDiv) return;

    if (password.length > 0) {
        reqDiv.classList.remove('hidden');

        const requirements = validatePassword(password);

        // Update each requirement indicator
        const lengthEl = document.getElementById('req-length');
        const letterEl = document.getElementById('req-letter');
        const numberEl = document.getElementById('req-number');

        if (lengthEl) {
            lengthEl.style.color = requirements.length ? '#10b981' : 'var(--text-secondary)';
            lengthEl.innerHTML = requirements.length ? '✅ At least 6 characters' : 'At least 6 characters';
        }
        if (letterEl) {
            letterEl.style.color = requirements.letter ? '#10b981' : 'var(--text-secondary)';
            letterEl.innerHTML = requirements.letter ? '✅ Contains a letter' : 'Contains a letter';
        }
        if (numberEl) {
            numberEl.style.color = requirements.number ? '#10b981' : 'var(--text-secondary)';
            numberEl.innerHTML = requirements.number ? '✅ Contains a number' : 'Contains a number';
        }
    } else {
        reqDiv.classList.add('hidden');
    }
}

window.updatePasswordRequirements = updatePasswordRequirements;

function updateObPasswordRequirements(password) {
    const reqDiv = document.getElementById('ob-password-requirements');
    if (!reqDiv) return;
    if (password.length > 0) {
        reqDiv.classList.remove('hidden');
        const requirements = validatePassword(password);
        const lengthEl = document.getElementById('ob-req-length');
        const letterEl = document.getElementById('ob-req-letter');
        const numberEl = document.getElementById('ob-req-number');
        if (lengthEl) {
            lengthEl.style.color = requirements.length ? '#10b981' : 'var(--text-secondary)';
            lengthEl.innerHTML   = requirements.length ? '✅ At least 6 characters' : 'At least 6 characters';
        }
        if (letterEl) {
            letterEl.style.color = requirements.letter ? '#10b981' : 'var(--text-secondary)';
            letterEl.innerHTML   = requirements.letter ? '✅ Contains a letter' : 'Contains a letter';
        }
        if (numberEl) {
            numberEl.style.color = requirements.number ? '#10b981' : 'var(--text-secondary)';
            numberEl.innerHTML   = requirements.number ? '✅ Contains a number' : 'Contains a number';
        }
    } else {
        reqDiv.classList.add('hidden');
    }
}

window.updateObPasswordRequirements = updateObPasswordRequirements;

// Add event listener to password field
document.addEventListener('DOMContentLoaded', () => {
    const passwordField = document.getElementById('auth-password');
    if (passwordField) {
        passwordField.addEventListener('input', (e) => {
            updatePasswordRequirements(e.target.value);
        });
    }
});

async function handleGoogleSignIn() {
    showToast('Opening Google sign in...');
    const result = await window.firebaseSignInWithGoogle();

    if (result.success) {
        showToast('✅ Signed in with Google!');
    } else {
        showToast('❌ Google sign in failed: ' + result.error);
    }
}

window.handleGoogleSignIn = handleGoogleSignIn;

async function handleSignOut() {
    const confirmed = await showConfirmation('Are you sure you want to sign out? You can sign in again anytime to access your cloud data.');

    if (!confirmed) return;

    showToast('Signing out...');
    const result = await window.firebaseSignOut();

    if (result.success) {
        showToast('✅ Signed out successfully');
        // Reload to reset to demo mode
        setTimeout(() => location.reload(), 1500);
    } else {
        showToast('❌ Sign out failed: ' + result.error);
    }
}

window.handleSignOut = handleSignOut;

async function handleSyncData() {
    if (!window.firebaseUserId) {
        showToast('Not signed in');
        return;
    }

    const syncBtn = document.getElementById('sync-data-btn');
    if (syncBtn) syncBtn.disabled = true;

    showToast('Syncing data to cloud...');
    const result = await window.syncDataToFirestore(window.firebaseUserId);

    if (syncBtn) syncBtn.disabled = false;

    if (result.success) {
        const lastSyncEl = document.getElementById('auth-last-sync');
        if (lastSyncEl) {
            lastSyncEl.textContent = 'Last synced: Just now';
        }
        showToast('✅ Data synced to cloud successfully!');
    } else {
        showToast('❌ Sync failed: ' + result.error);
    }
}

window.handleSyncData = handleSyncData;

function isUserActivelyEditing() {
    // If any input, textarea, or select has focus the user is mid-entry
    const el = document.activeElement;
    if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
            return true;
        }
    }
    // Stock items or notes opened in edit mode (isEditing flag lives only in memory)
    if (stock.some(item => item.isEditing)) return true;
    if (notes.some(note => note.isEditing)) return true;
    return false;
}

function refreshAppData() {
    // Reload all in-memory data from localStorage
    const loadedCompanyDetails = loadDataFromLocalStorage('companyDetails', {});
    companyDetails = loadedCompanyDetails;
    if (!companyDetails.industryMode) companyDetails.industryMode = 'general';

    const storedOrders = loadDataFromLocalStorage('orders', []);
    const processedOrders = storedOrders.map(order => ({
        ...order,
        orderDate: order.orderDate ? new Date(order.orderDate) : new Date()
    }));
    orders = processedOrders.filter(order => !order.isDelivered);
    completedOrders = processedOrders.filter(order => order.isDelivered);
    orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    completedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const storedNotes = loadDataFromLocalStorage('notes', []);
    notes = storedNotes.map(note => ({
        ...note,
        createdAt: note.createdAt ? new Date(note.createdAt) : new Date()
    }));
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const storedStock = loadDataFromLocalStorage('stock', []);
    stock = storedStock.map(item => ({
        ...item,
        price: parseFloat(item.price),
        quantity: item.quantity !== undefined ? parseInt(item.quantity) : 0,
        barcode: item.barcode || generateBarcodeNumber()
    }));
    stock.sort((a, b) => a.name.localeCompare(b.name));

    // Do not re-render if the user is actively editing or entering data anywhere
    // (billing, adding stock, editing a note, filling settings, etc.)
    if (currentPage && !isUserActivelyEditing() && currentPage !== 'addOrder') {
        renderPage(currentPage);
    }
}
window.refreshAppData = refreshAppData;

async function handleLoadData() {
    if (!window.firebaseUserId) {
        showToast('Not signed in');
        return;
    }

    const confirmed = await showConfirmation('Load data from cloud? This will replace your current local data.');
    if (!confirmed) return;

    showToast('Loading data from cloud...');
    const result = await window.loadDataFromFirestore(window.firebaseUserId);

    if (result.success && result.data) {
        // Write cloud data to the stable local key (userId) so it is immediately
        // available in-memory after the reload, regardless of Firebase UID.
        if (result.data.orders) localStorage.setItem(`quickbill-${userId}-orders`, result.data.orders);
        if (result.data.stock) localStorage.setItem(`quickbill-${userId}-stock`, result.data.stock);
        if (result.data.notes) localStorage.setItem(`quickbill-${userId}-notes`, result.data.notes);
        if (result.data.companyDetails) localStorage.setItem(`quickbill-${userId}-companyDetails`, result.data.companyDetails);

        showToast('✅ Data loaded successfully!');
        refreshAppData();
    } else {
        showToast(result.error === 'No data found' ? '📦 No cloud data found' : '❌ Load failed: ' + result.error);
    }
}

window.handleLoadData = handleLoadData;

// --- Settings Page Logic ---
function renderSettings() {
    document.getElementById('companyName').value = companyDetails.companyName || '';
    document.getElementById('address').value = companyDetails.address || '';
    document.getElementById('phone').value = companyDetails.phone || '';
    document.getElementById('email').value = companyDetails.email || '';
    document.getElementById('gstNumber').value = companyDetails.gstNumber || '';
    document.getElementById('defaultBillNotes').value = companyDetails.defaultBillNotes || '';
    document.getElementById('gstRateSetting').value = (companyDetails.gstRate || 0).toString();

    // Update industry mode UI
    updateIndustryModeUI(getIndustryMode());

    // Update connection mode UI
    updateConnectionModeUI(localStorage.getItem('quickbill-connection-mode') || 'online');
    if (window.firebaseUser) {
        updateAuthUI(window.firebaseUser);
    }
}

document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!userId) {
        showToast("User not authenticated. Please try again.");
        return;
    }

    companyDetails = {
        companyName: document.getElementById('companyName').value.trim(),
        address: document.getElementById('address').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        gstNumber: document.getElementById('gstNumber').value.trim(),
        defaultBillNotes: document.getElementById('defaultBillNotes').value.trim(),
        industryMode: companyDetails.industryMode || 'general',
        gstRate: parseFloat(document.getElementById('gstRateSetting').value) || 0
    };

    saveDataToLocalStorage('companyDetails', companyDetails);
    showToast("Company details and bill customization settings saved successfully!");
});

function exportData() {
    if (!userId) {
        showToast("User not authenticated. Cannot export data.");
        return;
    }

    const dataToExport = {
        companyDetails: companyDetails,
        orders: [...orders, ...completedOrders].map(order => ({
            ...order,
            orderDate: new Date(order.orderDate).toISOString()
        })),
        notes: notes.map(note => ({
            ...note,
            createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString()
        })),
        stock: stock
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quickbill_pro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("All data exported successfully!");
}

document.getElementById('import-file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            if (
                !importedData ||
                typeof importedData.companyDetails !== 'object' ||
                !Array.isArray(importedData.orders) ||
                !Array.isArray(importedData.notes) ||
                !Array.isArray(importedData.stock)
            ) {
                showToast("Invalid data file format. Please upload a valid export file.");
                return;
            }

            // Check if user has existing data
            const hasExistingData = orders.length > 0 || completedOrders.length > 0 || stock.length > 0 || notes.length > 0;

            let shouldReplace = true;
            if (hasExistingData) {
                shouldReplace = await showConfirmation("You have existing data. Choose 'Yes' to REPLACE all data (existing data will be deleted) or 'No' to MERGE imported data with existing data (keeps both).");
            }

            if (shouldReplace) {
                // Replace mode - overwrite all data
                companyDetails = {
                    gstNumber: '',
                    defaultBillNotes: '',
                    industryMode: 'general',
                    ...importedData.companyDetails
                };

                const processedImportedOrders = importedData.orders.map(order => ({
                    ...order,
                    orderDate: order.orderDate ? new Date(order.orderDate) : new Date()
                }));
                orders = processedImportedOrders.filter(order => !order.isDelivered);
                completedOrders = processedImportedOrders.filter(order => order.isDelivered);
                orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                completedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

                const processedImportedNotes = importedData.notes.map(note => ({
                    ...note,
                    createdAt: note.createdAt ? new Date(note.createdAt) : new Date()
                }));
                notes = processedImportedNotes;
                notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                stock = importedData.stock.map(item => ({
                    ...item,
                    price: parseFloat(item.price)
                }));
                stock.sort((a, b) => a.name.localeCompare(b.name));

                showToast("Data replaced successfully!");
            } else {
                // Merge mode - combine imported data with existing data
                companyDetails = {
                    ...companyDetails,
                    ...importedData.companyDetails
                };

                const processedImportedOrders = importedData.orders.map(order => ({
                    ...order,
                    orderDate: order.orderDate ? new Date(order.orderDate) : new Date()
                }));

                // Merge orders - avoid duplicates by ID
                const existingOrderIds = new Set([...orders, ...completedOrders].filter(o => o.id).map(o => o.id));
                const newOrders = processedImportedOrders.filter(order => order.id && !existingOrderIds.has(order.id));

                orders = [...orders, ...newOrders.filter(order => !order.isDelivered)];
                completedOrders = [...completedOrders, ...newOrders.filter(order => order.isDelivered)];
                orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                completedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

                // Merge notes - avoid duplicates by ID
                const processedImportedNotes = importedData.notes.map(note => ({
                    ...note,
                    createdAt: note.createdAt ? new Date(note.createdAt) : new Date()
                }));
                const existingNoteIds = new Set(notes.filter(n => n.id).map(n => n.id));
                const newNotes = processedImportedNotes.filter(note => note.id && !existingNoteIds.has(note.id));
                notes = [...notes, ...newNotes];
                notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                // Merge stock - avoid duplicates by ID, update existing items
                const importedStock = importedData.stock.map(item => ({
                    ...item,
                    price: parseFloat(item.price)
                }));

                const stockMap = new Map(stock.filter(item => item.id).map(item => [item.id, item]));
                importedStock.forEach(item => {
                    if (item.id) {
                        stockMap.set(item.id, item);
                    }
                });
                stock = Array.from(stockMap.values());
                stock.sort((a, b) => a.name.localeCompare(b.name));

                showToast("Data merged successfully!");
            }

            saveDataToLocalStorage('companyDetails', companyDetails);
            saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
            saveDataToLocalStorage('notes', notes);
            saveDataToLocalStorage('stock', stock);

            renderSettings();
            renderAllOrders();
            renderNotes();
            renderStock();
        } catch (error) {
            console.error("Error importing data:", error);
            showToast("Failed to import data. Please ensure the file is a valid JSON.");
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
});

async function resetApp() {
    const isOnlineUser = window.firebaseUser && !window.firebaseUser.isAnonymous;
    const confirmMsg = isOnlineUser
        ? "Are you sure you want to clear all your data? This will permanently delete your orders, stock, notes, and business details from this device and the cloud. Your account will not be deleted."
        : "Are you sure you want to clear all your data? This will permanently delete your orders, stock, notes, and business details from this device.";
    const confirmed = await showConfirmation(confirmMsg);
    if (confirmed) {
        const uid = userId || 'local';
        const dataKeys = ['orders', 'stock', 'notes', 'companyDetails'];
        // Write empty data to localStorage for each key
        dataKeys.forEach(key => {
            const defaultVal = key === 'companyDetails' ? '{}' : '[]';
            localStorage.setItem(`quickbill-${uid}-${key}`, defaultVal);
        });
        // If signed-in cloud user, push the empty data to Firestore as well
        if (isOnlineUser && window.syncDataToFirestore) {
            try {
                const result = await window.syncDataToFirestore(window.firebaseUserId);
                if (!result.success) {
                    showToast('⚠️ Local data cleared but cloud sync failed. Try syncing manually.');
                    return;
                }
            } catch (e) {
                showToast('⚠️ Local data cleared but cloud sync failed. Try syncing manually.');
                return;
            }
        }
        localStorage.removeItem('quickbill-setup-complete');
        localStorage.removeItem('quickbill-had-named-account');
        showToast("All data cleared successfully. Reloading...");
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// --- Clear Completed Orders ---
document.getElementById('clear-completed-orders-btn').addEventListener('click', async () => {
    const confirmed = await showConfirmation("Are you sure you want to clear all delivered orders? This action cannot be undone.");
    if (confirmed) {
        completedOrders = [];
        saveDataToLocalStorage('orders', [...orders, ...completedOrders]);
        showToast("All delivered orders cleared!");
        renderAllOrders();
    }
});

// --- Date Filter Event Listeners ---
document.querySelectorAll('.date-filter-button').forEach(button => {
    button.addEventListener('click', function() {
        dashboardRange = parseInt(this.dataset.range);
        updateDashboardData(dashboardRange);
    });
});

// --- Initial Load ---
window.addEventListener('load', () => {
    console.log('App loading started...');

    // Setup confirmation modal first
    setupConfirmationModal();

    // Guard against double-initialization (can happen if Firebase resolves after the timeout)
    let _appInitialized = false;

    // Wait for Firebase or use demo mode
    const initializeApp = () => {
        if (_appInitialized) return;
        _appInitialized = true;

        try {
            // Load dark mode preference first
            loadDarkMode();
            console.log('Dark mode loaded');

            // Always use a stable persistent local ID for localStorage so data
            // survives page refreshes in every mode. Cloud sync uses the Firebase
            // UID as the Firestore document path but reads/writes the same local keys.
            let persistedId = localStorage.getItem('quickbill-local-user-id');
            if (!persistedId) {
                persistedId = 'local-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                localStorage.setItem('quickbill-local-user-id', persistedId);
            }
            userId = persistedId;
            // Expose so syncDataToFirestore / loadDataFromFirestore can find the right keys
            window.quickbillLocalUserId = userId;
            console.log('Using persistent local user ID:', userId);


            document.getElementById('mobile-user-id').textContent = `User ID: ${userId.substr(0, 12)}...`;
            isAuthReady = true;

            // Load data from localStorage
            companyDetails = { ...companyDetails, ...loadDataFromLocalStorage('companyDetails', {}) };
            // Ensure industryMode is preserved
            if (!companyDetails.industryMode) companyDetails.industryMode = 'general';

            const storedOrders = loadDataFromLocalStorage('orders', []);
            const processedOrders = storedOrders.map(order => ({
                ...order,
                orderDate: order.orderDate ? new Date(order.orderDate) : new Date()
            }));

            orders = processedOrders.filter(order => !order.isDelivered);
            completedOrders = processedOrders.filter(order => order.isDelivered);

            orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
            completedOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

            const storedNotes = loadDataFromLocalStorage('notes', []);
            notes = storedNotes.map(note => ({
                ...note,
                createdAt: note.createdAt ? new Date(note.createdAt) : new Date()
            }));
            notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const storedStock = loadDataFromLocalStorage('stock', []);
            stock = storedStock.map(item => ({
                ...item,
                price: parseFloat(item.price),
                quantity: item.quantity !== undefined ? parseInt(item.quantity) : 0,
                barcode: item.barcode || generateBarcodeNumber()
            }));
            stock.sort((a, b) => a.name.localeCompare(b.name));

            // Save stock with new barcodes
            saveDataToLocalStorage('stock', stock);
            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Initialization error:', error);
        } finally {
            // Always hide loading overlay even if there's an error
            setTimeout(() => {
                console.log('Hiding loading overlay...');
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.classList.add('hidden');

                        const isSetupComplete = localStorage.getItem('quickbill-setup-complete');
                        const connMode = localStorage.getItem('quickbill-connection-mode') || 'online';
                        const hasNamedAccount = window.firebaseUser && !window.firebaseUser.isAnonymous;
                        // Only re-prompt sign-in when the user *previously* had a named account
                        // (session lapsed). Never block first-time or always-anonymous users.
                        const hadNamedAccount = localStorage.getItem('quickbill-had-named-account') === '1';
                        const shouldShowWelcomeBack = connMode === 'online' && hadNamedAccount && !hasNamedAccount;

                        if (!isSetupComplete) {
                            // First-time user → onboarding
                            showOnboarding();
                        } else {
                            // Render dashboard immediately so local data is always accessible
                            renderPage('dashboard');
                            if (shouldShowWelcomeBack) {
                                // Session lapsed — prompt to re-sign-in for cloud sync
                                const wb = document.getElementById('welcome-back-overlay');
                                if (wb) { wb.style.display = 'flex'; }
                            }
                            console.log('App loaded successfully!');
                        }
                    }, 250);
                } else {
                    console.error('Loading overlay element not found!');
                }
            }, 400);
        }
    };

    // Initialize immediately or wait for Firebase
    if (window.isFirebaseReady) {
        initializeApp();
    } else {
        // Wait for Firebase with timeout
        const firebaseTimeout = setTimeout(() => {
            console.log('Firebase timeout - using demo mode');
            initializeApp();
        }, 2000);

        window.addEventListener('firebase-ready', () => {
            clearTimeout(firebaseTimeout);
            initializeApp();
        });
    }
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// Navigation event listeners
document.getElementById('nav-dashboard').addEventListener('click', () => renderPage('dashboard'));
document.getElementById('nav-addOrder').addEventListener('click', () => renderPage('addOrder'));
document.getElementById('nav-stock').addEventListener('click', () => renderPage('stock'));
document.getElementById('nav-notes').addEventListener('click', () => renderPage('notes'));
document.getElementById('nav-allOrders').addEventListener('click', () => renderPage('allOrders'));
document.getElementById('nav-settings').addEventListener('click', () => renderPage('settings'));

// Search functionality
document.getElementById('order-search-input').addEventListener('input', renderAllOrders);

// ═══════════════════════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════════════════════

// Capture install prompt as early as possible
window._deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._deferredInstallPrompt = e;
});

let _obSelectedIndustry = 'general';

/** Strip Firebase noise from error messages */
function cleanFirebaseError(msg) {
    return (msg || '').replace('Firebase: ', '').replace(/\s*\(auth[^)]*\)\.?/g, '').trim();
}

/**
 * Returns true when the email address has a plausible, non-gibberish domain.
 * Checks strict format, TLD validity, and keyboard-pattern / no-vowel heuristics.
 */
function isValidEmailDomain(email) {
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) return false;
    const domain = email.split('@')[1].toLowerCase(); // normalise before all checks
    const parts  = domain.split('.');
    if (parts.length < 2) return false;
    const tld        = parts[parts.length - 1];
    const domainName = parts.slice(0, -1).join('');
    // TLD must be 2-24 lowercase letters (domain is already lowercased above)
    if (!/^[a-z]{2,24}$/.test(tld)) return false;
    // Domain name must be at least 2 characters
    if (domainName.length < 2) return false;
    const letters = domainName.replace(/[^a-z]/g, '');
    // Block keyboard-row patterns of 5+ consecutive keys (e.g. qwerty, asdfgh, zxcvbn)
    const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (const row of keyboardRows) {
        for (let i = 0; i <= row.length - 5; i++) { // 5 = min run length to flag as gibberish
            if (letters.includes(row.substring(i, i + 5))) return false;
        }
    }
    // Domains with 8+ letters must contain at least one vowel (pure consonant strings like
    // 'rstlnbcd' are almost certainly random keyboard mashing)
    if (letters.length >= 8 && !/[aeiou]/.test(letters)) return false;
    return true;
}

/** True when auto-sync should run */
function shouldAutoSync() {
    if (typeof window.scheduleAutoSync !== 'function') return false;
    // Always sync when a named (non-anonymous) account is signed in
    if (window.firebaseUser && !window.firebaseUser.isAnonymous) return true;
    return localStorage.getItem('quickbill-connection-mode') !== 'offline';
}

function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function obGoStep(n) {
    document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`ob-step-${n}`);
    if (target) target.classList.add('active');
}

function obChooseMode(mode) {
    localStorage.setItem('quickbill-connection-mode', mode);
    if (mode === 'online') {
        obGoStep(2);
    } else {
        obGoStep(3);
    }
}

async function obHandleGoogle() {
    if (!window.firebaseSignInWithGoogle) { obGoStep(3); return; }
    const err = document.getElementById('ob-auth-error');
    err.classList.add('hidden');
    const result = await window.firebaseSignInWithGoogle();
    if (result.success) {
        obGoStep(3);
    } else {
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

async function obHandleSignIn(event) {
    if (event) event.preventDefault();
    const email    = document.getElementById('ob-email').value.trim();
    const password = document.getElementById('ob-password').value;
    const err      = document.getElementById('ob-auth-error');
    err.classList.add('hidden');
    document.getElementById('ob-verification-notice')?.classList.add('hidden');
    if (!email || !password) {
        err.textContent = 'Please enter your email and password.';
        err.classList.remove('hidden');
        return;
    }
    if (!isValidEmailDomain(email)) {
        err.textContent = 'Please enter a valid email address.';
        err.classList.remove('hidden');
        return;
    }
    if (!window.firebaseSignInWithEmail) { obGoStep(3); return; }
    const result = await window.firebaseSignInWithEmail(email, password);
    if (result.success) {
        obGoStep(3);
    } else if (result.error === 'email-not-verified') {
        const notice = document.getElementById('ob-verification-notice');
        const display = document.getElementById('ob-verify-email-display');
        if (display) display.textContent = email;
        if (notice) notice.classList.remove('hidden');
        err.textContent = 'Please verify your email before signing in.';
        err.classList.remove('hidden');
    } else {
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

async function obHandleSignUp() {
    const email    = document.getElementById('ob-email').value.trim();
    const password = document.getElementById('ob-password').value;
    const err      = document.getElementById('ob-auth-error');
    err.classList.add('hidden');
    document.getElementById('ob-verification-notice')?.classList.add('hidden');
    if (!email || !password) {
        err.textContent = 'Please enter your email and password.';
        err.classList.remove('hidden');
        return;
    }
    if (!isValidEmailDomain(email)) {
        err.textContent = 'Please enter a valid email address with a real domain.';
        err.classList.remove('hidden');
        return;
    }
    const req = validatePassword(password);
    if (!req.length) {
        err.textContent = 'Password must be at least 6 characters.';
        err.classList.remove('hidden');
        return;
    }
    if (!req.letter) {
        err.textContent = 'Password must contain at least one letter.';
        err.classList.remove('hidden');
        return;
    }
    if (!req.number) {
        err.textContent = 'Password must contain at least one number.';
        err.classList.remove('hidden');
        return;
    }
    // Hint password managers to save as a new credential
    const pwField = document.getElementById('ob-password');
    if (pwField) pwField.setAttribute('autocomplete', 'new-password');
    if (!window.firebaseSignUpWithEmail) { obGoStep(3); return; }
    const result = await window.firebaseSignUpWithEmail(email, password);
    if (pwField) pwField.setAttribute('autocomplete', 'current-password');
    if (result.success) {
        // Use Credential Management API to save credentials on supporting browsers
        if (window.PasswordCredential) {
            try {
                const cred = new window.PasswordCredential({ id: email, password });
                await navigator.credentials.store(cred);
            } catch (credErr) { console.debug('PasswordCredential store failed:', credErr); }
        }
        const display = document.getElementById('ob-verify-email-display');
        if (display) display.textContent = email;
        document.getElementById('ob-verification-notice')?.classList.remove('hidden');
        err.classList.add('hidden');
    } else {
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

async function obResendVerification() {
    const email    = document.getElementById('ob-email').value.trim();
    const password = document.getElementById('ob-password').value;
    const err      = document.getElementById('ob-auth-error');
    if (!email || !password) {
        err.textContent = 'Enter your email and password above, then click Resend.';
        err.classList.remove('hidden');
        return;
    }
    const result = await window.firebaseResendVerificationEmail(email, password);
    if (result.success) {
        if (result.alreadyVerified) {
            document.getElementById('ob-verification-notice')?.classList.add('hidden');
            err.textContent = 'Email already verified — sign in now!';
            err.classList.remove('hidden');
        } else {
            err.textContent = '✅ Verification email resent! Check your inbox.';
            err.style.color = '#10b981';
            err.classList.remove('hidden');
        }
    } else {
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

window.obResendVerification = obResendVerification;

function obSetIndustry(mode) {
    _obSelectedIndustry = mode;
    ['general', 'medical', 'grocery'].forEach(k => {
        const btn = document.getElementById(`ob-ind-${k}`);
        if (btn) btn.classList.remove('active', 'active-medical', 'active-grocery');
    });
    const chosen = document.getElementById(`ob-ind-${mode}`);
    if (chosen) {
        if (mode === 'medical') chosen.classList.add('active-medical');
        else if (mode === 'grocery') chosen.classList.add('active-grocery');
        else chosen.classList.add('active');
    }
}

// Called after Step 3 — go to install step if prompt is available, else finish
function obComplete() {
    // Persist company details entered in onboarding into the global companyDetails
    const name    = document.getElementById('ob-company-name')?.value.trim() || '';
    const phone   = document.getElementById('ob-phone')?.value.trim() || '';
    const address = document.getElementById('ob-address')?.value.trim() || '';
    const bizEmail = document.getElementById('ob-business-email')?.value.trim() || '';
    const gstNum  = document.getElementById('ob-gst-number')?.value.trim() || '';
    if (name)     companyDetails.companyName = name;
    if (phone)    companyDetails.phone       = phone;
    if (address)  companyDetails.address     = address;
    if (bizEmail) companyDetails.email       = bizEmail;
    if (gstNum)   companyDetails.gstNumber   = gstNum;
    companyDetails.industryMode = _obSelectedIndustry;
    saveDataToLocalStorage('companyDetails', companyDetails);

    // Decide whether to show install step
    if (window._deferredInstallPrompt) {
        obGoStep(4);
    } else {
        obFinish();
    }
}

async function obTriggerInstall() {
    const prompt = window._deferredInstallPrompt;
    if (!prompt) { obFinish(); return; }
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window._deferredInstallPrompt = null;
    if (outcome === 'accepted') {
        showToast('✅ App installed!');
    }
    obFinish();
}

function obFinish() {
    localStorage.setItem('quickbill-setup-complete', '1');
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.classList.add('hidden');
    updateIndustryModeUI(_obSelectedIndustry);
    renderPage('dashboard');
}

// ═══════════════════════════════════════════════════════════
//  CONNECTION MODE (Settings card)
// ═══════════════════════════════════════════════════════════

function setConnectionMode(mode) {
    localStorage.setItem('quickbill-connection-mode', mode);
    updateConnectionModeUI(mode);
    if (mode === 'online') {
        showToast('☁️ Online mode — data will sync to cloud when signed in');
    } else {
        showToast('📱 Offline mode — local data preserved. Cloud sync continues when signed in.');
    }
}

function updateConnectionModeUI(mode) {
    const onlineBtn  = document.getElementById('conn-btn-online');
    const offlineBtn = document.getElementById('conn-btn-offline');
    if (!onlineBtn) return;
    onlineBtn.classList.remove('active');
    offlineBtn.classList.remove('active');
    if (mode === 'online') onlineBtn.classList.add('active');
    else                   offlineBtn.classList.add('active');

    const desc = document.getElementById('conn-mode-description');
    if (desc) {
        desc.innerHTML = mode === 'online'
            ? '☁️ <strong>Online</strong> — Data is backed up to the cloud and syncs across all your signed-in devices.'
            : '📱 <strong>Offline</strong> — All data is saved on this device. When signed in, your data will still sync to the cloud automatically.';
    }
}

// ═══════════════════════════════════════════════════════════
//  WELCOME-BACK MODAL (returning online user, session lapsed)
// ═══════════════════════════════════════════════════════════

async function wbHandleGoogle() {
    if (!window.firebaseSignInWithGoogle) { wbContinueOffline(); return; }
    const result = await window.firebaseSignInWithGoogle();
    if (result.success) {
        location.reload();
    } else {
        const err = document.getElementById('wb-auth-error');
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

async function wbHandleSignIn(event) {
    if (event) event.preventDefault();
    const email    = document.getElementById('wb-email').value.trim();
    const password = document.getElementById('wb-password').value;
    const err      = document.getElementById('wb-auth-error');
    err.classList.add('hidden');
    if (!email || !password) {
        err.textContent = 'Please enter your email and password.';
        err.classList.remove('hidden');
        return;
    }
    if (!isValidEmailDomain(email)) {
        err.textContent = 'Please enter a valid email address.';
        err.classList.remove('hidden');
        return;
    }
    const result = await window.firebaseSignInWithEmail(email, password);
    if (result.success) {
        location.reload();
    } else if (result.error === 'email-not-verified') {
        err.textContent = 'Please verify your email first. Check your inbox for the verification link.';
        err.classList.remove('hidden');
    } else {
        err.textContent = cleanFirebaseError(result.error);
        err.classList.remove('hidden');
    }
}

function wbContinueOffline() {
    // Dismiss the welcome-back overlay; the dashboard is already rendered behind it.
    // Do NOT force offline mode — the user keeps whatever mode they chose.
    const wb = document.getElementById('welcome-back-overlay');
    if (wb) wb.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════
//  AUTO-RECONNECT SYNC (online users, wifi comes back)
// ═══════════════════════════════════════════════════════════

window.addEventListener('online', () => {
    if (shouldAutoSync() &&
        window.firebaseUser && !window.firebaseUser.isAnonymous) {
        showToast('✅ Back online — syncing…');
        window.scheduleAutoSync();
    }
});

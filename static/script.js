function applyFilters() {
    const filters = {
        search: document.getElementById('searchInput').value,
        category: Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value),
        brand: Array.from(document.querySelectorAll('input[name="brand"]:checked')).map(cb => cb.value),
        price_range: [0, document.getElementById('priceRange').value]
    };

    fetch('/filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
    })
    .then(response => response.json())
    .then(products => updateProductGrid(products));
}

// static/js/script.js

const SessionManager = {
    currentCustomerId: null,

    init() {
        this.setupCustomerIdListener();
    },

    setupCustomerIdListener() {
        const customerInput = document.getElementById('customerId');
        if (customerInput) {
            customerInput.addEventListener('change', (e) => {
                const customerId = e.target.value.trim();
                if (customerId) {
                    this.setCustomerId(customerId);
                }
            });
        }
    },

    setCustomerId(customerId) {
        if (!customerId.trim()) return;

        this.currentCustomerId = customerId;
        ChatManager.loadCustomerHistory(customerId);
        
        // Update chat window header
        const chatHeader = document.querySelector('.chat-header h3');
        if (chatHeader) {
            chatHeader.textContent = `Chat Support - Customer ${customerId}`;
        }

        // Show welcome message
        ChatManager.addWelcomeMessage(customerId);
    },

    getCurrentCustomerId() {
        return this.currentCustomerId;
    },

    clearSession() {
        this.currentCustomerId = null;
        const customerInput = document.getElementById('customerId');
        if (customerInput) {
            customerInput.value = '';
        }
        ChatManager.clearChat();
    }
};

// static/js/filters.js

const FilterManager = {
    init() {
        this.setupFilterListeners();
        this.loadFilterValues();
    },

    setupFilterListeners() {
        // Category checkboxes
        document.querySelectorAll('input[name="category"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Brand checkboxes
        document.querySelectorAll('input[name="brand"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Price range
        const priceRange = document.getElementById('priceRange');
        if (priceRange) {
            priceRange.addEventListener('change', () => this.applyFilters());
        }

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', _.debounce(() => this.applyFilters(), 300));
        }
    },

    getFilterValues() {
        const filters = {
            category: Array.from(document.querySelectorAll('input[name="category"]:checked'))
                .map(cb => cb.value),
            brand: Array.from(document.querySelectorAll('input[name="brand"]:checked'))
                .map(cb => cb.value),
            price_range: document.getElementById('priceRange')?.value || '',
            customer_id: document.getElementById('customerId')?.value || '',
            search: document.getElementById('searchInput')?.value || ''
        };
        return filters;
    },

    loadFilterValues() {
        // Get URL parameters
        const params = new URLSearchParams(window.location.search);
        
        // Set customer ID
        const customerId = params.get('customer_id');
        if (customerId) {
            const customerInput = document.getElementById('customerId');
            if (customerInput) {
                customerInput.value = customerId;
                // Trigger customer ID change to load chat history
                SessionManager.setCustomerId(customerId);
            }
        }

        // Set categories
        params.getAll('category').forEach(category => {
            const checkbox = document.querySelector(`input[name="category"][value="${category}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Set brands
        params.getAll('brand').forEach(brand => {
            const checkbox = document.querySelector(`input[name="brand"][value="${brand}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Set price range
        const priceRange = params.get('price_range');
        if (priceRange) {
            const rangeInput = document.getElementById('priceRange');
            const priceValue = document.getElementById('priceValue');
            if (rangeInput) rangeInput.value = priceRange;
            if (priceValue) priceValue.textContent = `$${priceRange}`;
        }

        // Set search query
        const searchQuery = params.get('search');
        if (searchQuery) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = searchQuery;
        }
    },

    applyFilters() {
        const filters = this.getFilterValues();
        
        // Build query string
        const params = new URLSearchParams();
        
        filters.category.forEach(cat => params.append('category', cat));
        filters.brand.forEach(brand => params.append('brand', brand));
        if (filters.price_range) params.set('price_range', filters.price_range);
        if (filters.customer_id) params.set('customer_id', filters.customer_id);
        if (filters.search) params.set('search', filters.search);

        // Update URL without reloading page
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);

        // Update product cards
        this.fetchFilteredProducts(filters);
    },

    fetchFilteredProducts(filters) {
        fetch('/filter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filters)
        })
        .then(response => response.json())
        .then(products => this.updateProductGrid(products));
    },

    updateProductGrid(products) {
        const grid = document.querySelector('.products-grid');
        if (!grid) return;

        grid.innerHTML = products.map(product => `
            <div class="product-card" onclick="navigateToProduct(${product.id})">
                <div class="product-image">
                    <img src="${product.image_url}" alt="${product.name}">
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="price">$${product.price}</p>
                    <div class="rating">
                        ${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating))}
                        ${product.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                    </div>
                    <p class="stock">In Stock: ${product.stock}</p>
                </div>
            </div>
        `).join('');
    }
};

// Function to navigate to product page with current filters
function navigateToProduct(productId) {
    const filters = FilterManager.getFilterValues();
    const params = new URLSearchParams();
    
    // Only pass necessary values to product page
    if (filters.customer_id) params.set('customer_id', filters.customer_id);
    
    window.location.href = `/product/${productId}?${params.toString()}`;
}

const ChatManager = {
    MESSAGE_TYPES: {
        USER: 'user',
        BOT: 'bot',
        SYSTEM: 'system'
    },

    init() {
        this.setupEventListeners();
        this.setupAutoScroll();
        this.clearChat(); // Start with empty chat
        this.showInitialMessage();
    },

    showInitialMessage() {
        const chatContainer = document.getElementById('chatMessages');
        const initialMessage = this.createMessageElement({
            text: 'Please enter your Customer ID to start chatting.',
            type: this.MESSAGE_TYPES.SYSTEM,
            context: 'System',
            timestamp: new Date().toISOString()
        });
        chatContainer.appendChild(initialMessage);
    },

    clearChat() {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            chatContainer.innerHTML = '';
        }
    },

    addWelcomeMessage(customerId) {
        const history = this.getCustomerHistory(customerId);
        if (history.length === 0) {
            this.addMessage(
                `Welcome, Customer ${customerId}! How can we help you today?`,
                this.MESSAGE_TYPES.SYSTEM,
                'System'
            );
        }
    },

    getChatStorageKey(customerId) {
        return `chatHistory_${customerId}`;
    },

    loadCustomerHistory(customerId) {
        if (!customerId) return;

        this.clearChat();
        const history = this.getCustomerHistory(customerId);
        
        const chatContainer = document.getElementById('chatMessages');
        history.forEach(message => {
            chatContainer.appendChild(this.createMessageElement(message));
        });
        this.scrollToBottom();
    },

    getCustomerHistory(customerId) {
        try {
            return JSON.parse(localStorage.getItem(this.getChatStorageKey(customerId))) || [];
        } catch {
            return [];
        }
    },

    saveMessage(messageData, customerId) {
        if (!customerId) return;

        const history = this.getCustomerHistory(customerId);
        history.push(messageData);
        localStorage.setItem(this.getChatStorageKey(customerId), JSON.stringify(history));
    },

    createMessageElement(messageData) {
        const { text, type, timestamp, context } = messageData;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;

        const timeFormatted = new Date(timestamp).toLocaleString();
        
        messageDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-meta">
                <span class="message-context">${context || 'General'}</span>
                <span class="message-time">${timeFormatted}</span>
            </div>
        `;

        return messageDiv;
    },

    addMessage(text, type, context, customerId = SessionManager.getCurrentCustomerId()) {
        if (!customerId && type !== this.MESSAGE_TYPES.SYSTEM) {
            this.showCustomerIdPrompt();
            return false;
        }

        const messageData = {
            text,
            type,
            context,
            timestamp: new Date().toISOString(),
            customerId
        };

        const chatContainer = document.getElementById('chatMessages');
        chatContainer.appendChild(this.createMessageElement(messageData));
        if (customerId) {
            this.saveMessage(messageData, customerId);
        }
        this.scrollToBottom();
        return true;
    },

    showCustomerIdPrompt() {
        const customerInput = document.getElementById('customerId');
        customerInput.classList.add('highlight');
        setTimeout(() => customerInput.classList.remove('highlight'), 2000);
        
        this.addMessage(
            'Please enter your Customer ID to start chatting.',
            this.MESSAGE_TYPES.SYSTEM,
            'System'
        );
    },

    getCurrentContext() {
        const path = window.location.pathname;
        if (path === '/') {
            return 'Home Page';
        } else if (path.startsWith('/product/')) {
            const productTitle = document.querySelector('.product-info-section h1');
            return productTitle ? `Product: ${productTitle.textContent}` : 'Product Page';
        }
        return 'General';
    },

    scrollToBottom() {
        const chatContainer = document.getElementById('chatMessages');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    },

    setupEventListeners() {
        const input = document.getElementById('chatInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
    },

    setupAutoScroll() {
        const chatContainer = document.getElementById('chatMessages');
        const observer = new MutationObserver(() => this.scrollToBottom());
        observer.observe(chatContainer, { childList: true });
    }
};

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    const customerId = SessionManager.getCurrentCustomerId();
    
    if (!message) return;
    
    if (!customerId) {
        ChatManager.showCustomerIdPrompt();
        return;
    }
    
    input.value = '';

    if (ChatManager.addMessage(
        message,
        ChatManager.MESSAGE_TYPES.USER,
        ChatManager.getCurrentContext()
    )) {
        try {
            const response = await fetch('/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    context: ChatManager.getCurrentContext(),
                    customerId
                })
            });

            const data = await response.json();

            ChatManager.addMessage(
                data.response,
                ChatManager.MESSAGE_TYPES.BOT,
                ChatManager.getCurrentContext()
            );
        } catch (error) {
            ChatManager.addMessage(
                "Sorry, there was an error processing your message.",
                ChatManager.MESSAGE_TYPES.BOT,
                ChatManager.getCurrentContext()
            );
        }
    }
}

function toggleChat() {
    const chatWindow = document.querySelector('.chat-window');
    const isHidden = chatWindow.style.display === 'none';
    chatWindow.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden) {
        const customerId = SessionManager.getCurrentCustomerId();
        if (customerId) {
            document.getElementById('chatInput').focus();
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    SessionManager.init();
    ChatManager.init();
    FilterManager.init();
});

// Initialize price range display
document.getElementById('priceRange').addEventListener('input', function() {
    document.getElementById('priceValue').textContent = '$' + this.value;
});

// Add to your JavaScript file

function showProductModal(productId) {
    const product = window.productsData.find(p => p.id === productId);
    if (!product) return;

    // Update modal content
    document.getElementById('modalProductImage').src = product.image_url;
    document.getElementById('modalProductImage').alt = product.name;
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductPrice').textContent = `$${product.price}`;
    
    // Update rating
    const ratingDiv = document.getElementById('modalProductRating');
    const fullStars = Math.floor(product.rating);
    const hasHalfStar = product.rating % 1 >= 0.5;
    ratingDiv.innerHTML = `
        ${'<i class="fas fa-star"></i>'.repeat(fullStars)}
        ${hasHalfStar ? '<i class="fas fa-star-half-alt"></i>' : ''}
        <span class="rating-value">(${product.rating})</span>
    `;

    document.getElementById('modalProductDescription').textContent = product.description;
    
    // Update stock info
    const stockDiv = document.getElementById('modalProductStock');
    if (product.stock > 0) {
        stockDiv.innerHTML = `
            <span class="in-stock">
                <i class="fas fa-check"></i> In Stock (${product.stock} available)
            </span>
        `;
    } else {
        stockDiv.innerHTML = `
            <span class="out-of-stock">
                <i class="fas fa-times"></i> Out of Stock
            </span>
        `;
    }

    document.getElementById('modalProductBrand').innerHTML = `<strong>Brand:</strong> ${product.brand}`;
    document.getElementById('modalProductCategory').innerHTML = `<strong>Category:</strong> ${product.category}`;

    // Show mock reviews (you can replace this with real reviews data)
    const reviewsDiv = document.getElementById('modalProductReviews');
    reviewsDiv.innerHTML = generateMockReviews(product);

    // Show modal
    const modal = document.getElementById('productModal');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

function generateMockReviews(product) {
    // Generate some mock reviews based on the product rating
    const numberOfReviews = Math.floor(Math.random() * 5) + 3; // 3-7 reviews
    const reviews = [];
    
    for (let i = 0; i < numberOfReviews; i++) {
        const rating = Math.max(Math.min(
            product.rating + (Math.random() * 2 - 1), // Random variation around product rating
            5), 1);
            
        reviews.push(`
            <div class="review-card">
                <div class="review-header">
                    <div class="review-rating">
                        ${'<i class="fas fa-star"></i>'.repeat(Math.floor(rating))}
                        ${rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                    </div>
                    <span class="review-date">${generateRandomDate()}</span>
                </div>
                <div class="review-content">
                    <p class="review-text">${generateRandomReviewText(product, rating)}</p>
                    <p class="reviewer-name">- ${generateRandomName()}</p>
                </div>
            </div>
        `);
    }
    
    return reviews.join('');
}

function generateRandomDate() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // Random date within last 60 days
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function generateRandomName() {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function generateRandomReviewText(product, rating) {
    const positiveAdjectives = ['great', 'excellent', 'amazing', 'fantastic', 'wonderful'];
    const negativeAdjectives = ['disappointing', 'mediocre', 'not great', 'below average'];
    
    const adjective = rating >= 4 ? 
        positiveAdjectives[Math.floor(Math.random() * positiveAdjectives.length)] :
        negativeAdjectives[Math.floor(Math.random() * negativeAdjectives.length)];
    
    return `This ${product.category.toLowerCase()} is ${adjective}. ${rating >= 4 ? 'Would recommend!' : 'Could be better.'}`;
}

// Update your product card click handler
function updateProductGrid(products) {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    // Store products data globally for modal access
    window.productsData = products;

    grid.innerHTML = products.map(product => `
        <div class="product-card" onclick="showProductModal(${product.id})">
            <div class="product-image">
                <img src="${product.image_url}" alt="${product.name}">
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="price">$${product.price}</p>
                <div class="rating">
                    ${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating))}
                    ${product.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                </div>
                <p class="stock">In Stock: ${product.stock}</p>
            </div>
        </div>
    `).join('');
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('productModal');
    if (event.target === modal) {
        closeProductModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeProductModal();
    }
});
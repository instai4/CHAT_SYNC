class ChatSync {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.username = null;
        this.userColor = null;
        this.users = new Map();
        this.messageHistory = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.lastActiveUser = null;
        this.replyingTo = null;
        this.connectionAttempts = 0;
        
        // DOM Elements
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatArea: document.getElementById('chatArea'),
            usernameInput: document.getElementById('usernameInput'),
            joinButton: document.getElementById('joinButton'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            messagesContainer: document.getElementById('messagesContainer'),
            userList: document.getElementById('userList'),
            userCount: document.getElementById('userCount'),
            currentUserContainer: document.getElementById('currentUserContainer'),
            currentUserAvatar: document.getElementById('currentUserAvatar'),
            currentUserName: document.getElementById('currentUserName'),
            statusIndicator: document.getElementById('statusIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            typingIndicator: document.getElementById('typingIndicator'),
            serverAddress: document.getElementById('serverAddress'),
            emojiButton: document.getElementById('emojiButton'),
            appContainer: document.querySelector('.app-container')
        };
        
        // Emoji data for picker (simplified)
        this.emojiCategories = [
            { name: 'Smileys', emojis: ['😀', '😁', '😂', '🤣', '😊', '😎', '🥰', '😘'] },
            { name: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🤝', '💪', '👀', '🧠'] },
            { name: 'Objects', emojis: ['💻', '📱', '🎧', '🎮', '📚', '✏️', '🎨', '🎵'] }
        ];
        
        // Initialize
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAnimations();
        this.connectWebSocket();
        this.setupTheme();
        this.setupMessageInput();
        this.createNotificationStyles();
        this.createRippleStyles();
        this.createReplyStyles();
        this.createEmojiPicker();
    }
    
    setupTheme() {
        // Add theme class to body for dark mode support
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }
        
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });
    }
    
    connectWebSocket() {
        this.connectionAttempts++;
        
        // Determine WebSocket URL based on current host
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port || (protocol === 'wss:' ? 443 : 80);
        const wsUrl = `${protocol}//${host}:${port === '80' || port === '443' ? '' : port}`;
        
        // Update server address display
        this.elements.serverAddress.textContent = `${host}:${port === '80' || port === '443' ? '' : port}`;
        
        // Show connecting status
        this.updateConnectionStatus('connecting');
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connection established');
                this.connectionAttempts = 0;
                this.updateConnectionStatus('connected');
                this.showNotification('Connected to chat server', 'success');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                    this.showNotification('Error parsing message', 'error');
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('WebSocket connection closed:', event.code, event.reason);
                this.updateConnectionStatus('disconnected');
                
                // Show reconnection notification
                if (event.code !== 1000) {
                    this.showNotification('Connection lost. Reconnecting...', 'warning');
                }
                
                // Try to reconnect with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    this.connectWebSocket();
                }, delay);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
                this.showNotification('Connection error', 'error');
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.showNotification('Failed to connect to server', 'error');
        }
    }
    
    updateConnectionStatus(status) {
        const statusIndicator = this.elements.statusIndicator;
        const connectionStatus = this.elements.connectionStatus;
        
        statusIndicator.classList.remove('connecting', 'connected', 'disconnected', 'error');
        connectionStatus.classList.remove('connecting', 'connected', 'disconnected', 'error');
        
        switch (status) {
            case 'connecting':
                statusIndicator.classList.add('connecting');
                connectionStatus.classList.add('connecting');
                connectionStatus.textContent = 'Connecting...';
                connectionStatus.style.color = '#f59e0b';
                statusIndicator.style.backgroundColor = '#f59e0b';
                break;
                
            case 'connected':
                statusIndicator.classList.add('connected');
                connectionStatus.classList.add('connected');
                connectionStatus.textContent = 'Connected';
                connectionStatus.style.color = '#10b981';
                break;
                
            case 'disconnected':
                statusIndicator.classList.add('disconnected');
                connectionStatus.classList.add('disconnected');
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.style.color = '#ef4444';
                statusIndicator.style.backgroundColor = '#ef4444';
                break;
                
            case 'error':
                statusIndicator.classList.add('error');
                connectionStatus.classList.add('error');
                connectionStatus.textContent = 'Connection Error';
                connectionStatus.style.color = '#ef4444';
                statusIndicator.style.backgroundColor = '#ef4444';
                break;
        }
    }
    
    setupEventListeners() {
        // Join button click
        this.elements.joinButton.addEventListener('click', () => this.joinChat());
        
        // Enter key in username input
        this.elements.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinChat();
            }
        });
        
        // Username input focus effect
        this.elements.usernameInput.addEventListener('focus', () => {
            this.elements.usernameInput.parentElement.classList.add('focused');
        });
        
        this.elements.usernameInput.addEventListener('blur', () => {
            this.elements.usernameInput.parentElement.classList.remove('focused');
        });
        
        // Send button click
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Message input events
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.elements.messageInput.addEventListener('input', () => {
            this.handleTyping();
            this.updateSendButtonState();
        });
        
        // Message input focus effect
        this.elements.messageInput.addEventListener('focus', () => {
            this.elements.messageInput.parentElement.classList.add('focused');
        });
        
        this.elements.messageInput.addEventListener('blur', () => {
            this.elements.messageInput.parentElement.classList.remove('focused');
        });
        
        // Double click on user item to mention
        this.elements.userList.addEventListener('dblclick', (e) => {
            const userItem = e.target.closest('.user-item:not(.placeholder)');
            if (userItem) {
                const userName = userItem.querySelector('.user-name').textContent;
                this.mentionUser(userName);
            }
        });
        
        // Click on user item to view profile
        this.elements.userList.addEventListener('click', (e) => {
            const userItem = e.target.closest('.user-item:not(.placeholder)');
            if (userItem && !e.target.closest('.user-action')) {
                const userName = userItem.querySelector('.user-name').textContent;
                this.showUserProfile(userName);
            }
        });
        
        // Context menu for messages (right-click)
        this.elements.messagesContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const messageElement = e.target.closest('.message:not(.system-message)');
            if (messageElement) {
                this.showMessageContextMenu(e, messageElement);
            }
        });
        
        // Close context menu on click elsewhere
        document.addEventListener('click', () => {
            this.hideMessageContextMenu();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Focus message input when user presses /
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                if (this.username) {
                    this.elements.messageInput.focus();
                }
            }
            
            // Clear reply when pressing Escape
            if (e.key === 'Escape' && this.replyingTo) {
                this.clearReply();
            }
            
            // Jump to latest message with Ctrl+Home
            if (e.ctrlKey && e.key === 'Home') {
                e.preventDefault();
                this.scrollToBottom();
            }
        });
        
        // Window focus/blur events for notifications
        window.addEventListener('blur', () => {
            document.title = '💬 ChatSync (Away)';
        });
        
        window.addEventListener('focus', () => {
            document.title = 'ChatSync 💬';
            this.markMessagesAsRead();
        });
    }
    
    setupAnimations() {
        // Add ripple effect to buttons
        this.setupRippleEffects();
        
        // Add hover animations
        this.setupHoverEffects();
        
        // Add loading animation to join button
        this.setupLoadingAnimation();
    }
    
    setupRippleEffects() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-primary, .btn-icon')) {
                const button = e.target.closest('.btn-primary, .btn-icon');
                this.createRippleEffect(button, e);
            }
        });
    }
    
    createRippleEffect(element, event) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple 0.6s linear;
            width: ${size}px;
            height: ${size}px;
            top: ${y}px;
            left: ${x}px;
            pointer-events: none;
            z-index: 1;
        `;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            if (ripple.parentNode === element) {
                element.removeChild(ripple);
            }
        }, 600);
    }
    
    setupHoverEffects() {
        // Add hover effects to user items
        this.elements.userList.addEventListener('mouseover', (e) => {
            const userItem = e.target.closest('.user-item:not(.placeholder)');
            if (userItem) {
                const avatar = userItem.querySelector('.user-avatar');
                if (avatar) {
                    avatar.style.transform = 'scale(1.1) rotate(5deg)';
                }
            }
        });
        
        this.elements.userList.addEventListener('mouseout', (e) => {
            const userItem = e.target.closest('.user-item:not(.placeholder)');
            if (userItem) {
                const avatar = userItem.querySelector('.user-avatar');
                if (avatar) {
                    avatar.style.transform = 'scale(1) rotate(0deg)';
                }
            }
        });
        
        // Add hover effects to messages
        this.elements.messagesContainer.addEventListener('mouseover', (e) => {
            const messageElement = e.target.closest('.message:not(.system-message)');
            if (messageElement) {
                messageElement.style.transform = 'translateX(5px)';
            }
        });
        
        this.elements.messagesContainer.addEventListener('mouseout', (e) => {
            const messageElement = e.target.closest('.message:not(.system-message)');
            if (messageElement) {
                messageElement.style.transform = 'translateX(0)';
            }
        });
    }
    
    setupLoadingAnimation() {
        this.elements.joinButton.addEventListener('click', () => {
            if (this.elements.joinButton.disabled) return;
            
            const originalHTML = this.elements.joinButton.innerHTML;
            this.elements.joinButton.innerHTML = `
                <div class="loading-spinner"></div>
                <span>Joining...</span>
            `;
            this.elements.joinButton.disabled = true;
            
            // Add CSS for spinner
            const spinnerStyle = document.createElement('style');
            spinnerStyle.textContent = `
                .loading-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(spinnerStyle);
        });
    }
    
    setupMessageInput() {
        // Auto-resize textarea (if we were using textarea)
        this.elements.messageInput.addEventListener('input', () => {
            // For future textarea implementation
        });
        
        // Paste event for handling images/files
        this.elements.messageInput.addEventListener('paste', (e) => {
            // Check for image paste
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    this.handleImagePaste(blob);
                    e.preventDefault();
                    break;
                }
            }
        });
    }
    
    joinChat() {
        const username = this.elements.usernameInput.value.trim();
        
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            this.elements.usernameInput.focus();
            this.shakeElement(this.elements.usernameInput);
            return;
        }
        
        if (username.length > 20) {
            this.showNotification('Username must be 20 characters or less', 'error');
            this.shakeElement(this.elements.usernameInput);
            return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showNotification('Waiting for connection...', 'warning');
            return;
        }
        
        this.username = username;
        
        // Send join message to server
        this.ws.send(JSON.stringify({
            type: 'join',
            username: this.username,
            timestamp: Date.now()
        }));
        
        // Update UI with animation
        this.elements.currentUserName.textContent = this.username;
        this.elements.currentUserAvatar.style.backgroundColor = this.getRandomColor();
        this.elements.currentUserAvatar.textContent = this.username.charAt(0).toUpperCase();
        
        // Animate transition
        this.elements.welcomeScreen.style.opacity = '0';
        this.elements.welcomeScreen.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            this.elements.welcomeScreen.style.display = 'none';
            this.elements.chatArea.style.display = 'flex';
            
            // Animate chat area in
            setTimeout(() => {
                this.elements.chatArea.style.opacity = '1';
                this.elements.chatArea.style.transform = 'translateY(0)';
            }, 50);
        }, 300);
        
        // Enable message input
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.messageInput.focus();
        
        this.showNotification(`Welcome to ChatSync, ${username}! 🎉`, 'success');
        
        // Update document title
        document.title = `ChatSync 💬 - ${username}`;
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'init':
                // Initial connection data
                this.clientId = data.clientId;
                this.userColor = data.color || this.getRandomColor();
                this.messageHistory = data.messageHistory || [];
                
                // Set user color
                this.elements.currentUserAvatar.style.backgroundColor = this.userColor;
                this.elements.currentUserAvatar.textContent = this.username ? this.username.charAt(0).toUpperCase() : '?';
                
                // Add existing users with onlineSince
                if (data.users) {
                    data.users.forEach(user => {
                        user.onlineSince = Date.now();
                        this.users.set(user.id, user);
                    });
                    this.updateUserList();
                }
                
                // Load message history
                if (this.messageHistory.length > 0) {
                    this.messageHistory.forEach(message => {
                        this.displayMessage(message);
                    });
                    this.scrollToBottom(true);
                }
                
                // Show welcome message
                this.displaySystemMessage(`Welcome! You're connected with ${this.users.size} other user${this.users.size !== 1 ? 's' : ''}`);
                break;
                
            case 'user-joined':
                // New user joined
                data.user.onlineSince = Date.now();
                this.users.set(data.user.id, data.user);
                this.updateUserList();
                
                // Show user join animation
                this.displaySystemMessage(`${data.user.username} joined the chat`, true);
                this.playNotificationSound('join');
                
                // Update last active user for quick mention
                this.lastActiveUser = data.user.username;
                break;
                
            case 'user-left':
                // User left
                const user = this.users.get(data.userId);
                if (user) {
                    this.displaySystemMessage(`${user.username} left the chat`, true);
                }
                this.users.delete(data.userId);
                this.updateUserList();
                this.playNotificationSound('leave');
                break;
                
            case 'message':
                // New chat message
                data.timestamp = data.timestamp || Date.now();
                this.displayMessage(data);
                
                // Play notification sound if not focused
                if (!document.hasFocus() || document.hidden) {
                    this.playNotificationSound('message');
                    this.showDesktopNotification(data);
                }
                break;
                
            case 'typing':
                // Typing indicator
                this.handleTypingIndicator(data);
                break;
                
            case 'reaction':
                // Message reaction (future feature)
                this.handleMessageReaction(data);
                break;
                
            case 'message-edit':
                // Message edit (future feature)
                this.handleMessageEdit(data);
                break;
                
            case 'message-delete':
                // Message delete (future feature)
                this.handleMessageDelete(data);
                break;
        }
    }
    
    sendMessage() {
        const messageInput = this.elements.messageInput;
        const text = messageInput.value.trim();
        
        if (!text || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Prepare message data
        const messageData = {
            type: 'message',
            text: text,
            timestamp: Date.now(),
            replyTo: this.replyingTo
        };
        
        // Send message to server
        this.ws.send(JSON.stringify(messageData));
        
        // Clear input
        messageInput.value = '';
        
        // Reset typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this.ws.send(JSON.stringify({
                type: 'typing',
                isTyping: false
            }));
        }
        
        // Clear reply if set
        if (this.replyingTo) {
            this.clearReply();
        }
        
        // Update send button state
        this.updateSendButtonState();
    }
    
    handleTyping() {
        const messageInput = this.elements.messageInput;
        const text = messageInput.value.trim();
        
        if (text && !this.isTyping) {
            this.isTyping = true;
            this.ws.send(JSON.stringify({
                type: 'typing',
                isTyping: true
            }));
        } else if (!text && this.isTyping) {
            this.isTyping = false;
            this.ws.send(JSON.stringify({
                type: 'typing',
                isTyping: false
            }));
        }
        
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Set timeout to stop typing indicator after 1 second of inactivity
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping && !messageInput.value.trim()) {
                this.isTyping = false;
                this.ws.send(JSON.stringify({
                    type: 'typing',
                    isTyping: false
                }));
            }
        }, 1000);
    }
    
    handleTypingIndicator(data) {
        const typingIndicator = this.elements.typingIndicator;
        
        if (data.isTyping && data.userId !== this.clientId) {
            // Show typing indicator for this user
            const user = this.users.get(data.userId);
            if (user) {
                typingIndicator.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="user-avatar-mini" style="background-color: ${user.color}">${user.username.charAt(0).toUpperCase()}</div>
                        <span>${user.username} is typing</span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `;
                typingIndicator.classList.add('active');
                
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    typingIndicator.classList.remove('active');
                }, 3000);
            }
        } else {
            // Hide typing indicator
            typingIndicator.classList.remove('active');
        }
    }
    
    displayMessage(message) {
        const messagesContainer = this.elements.messagesContainer;
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.userId === this.clientId ? 'own-message' : 'other-message'}`;
        
        // Add message ID for future reference
        if (message.id) {
            messageElement.dataset.messageId = message.id;
        }
        
        // Format timestamp
        const time = new Date(message.timestamp);
        const timeString = this.formatRelativeTime(time);
        
        // Set message color
        const messageColor = message.color || this.getRandomColor();
        
        // Build message content with reply if exists
        let replySection = '';
        if (message.replyTo) {
            const replyUser = this.users.get(message.replyTo.userId) || { username: message.replyTo.username };
            replySection = `
                <div class="message-reply">
                    <div class="reply-line"></div>
                    <div class="reply-content">
                        <span class="reply-username">${this.escapeHtml(replyUser.username)}</span>
                        <span class="reply-text">${this.escapeHtml(message.replyTo.text)}</span>
                    </div>
                </div>
            `;
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender" style="color: ${messageColor}">${this.escapeHtml(message.username)}</span>
                <span class="message-time" title="${time.toLocaleString()}">${timeString}</span>
                <div class="message-actions">
                    <button class="message-action reply-action" title="Reply">
                        <i class="fas fa-reply"></i>
                    </button>
                    <button class="message-action react-action" title="React">
                        <i class="far fa-smile"></i>
                    </button>
                </div>
            </div>
            ${replySection}
            <div class="message-content">${this.formatMessageText(message.text)}</div>
            ${message.userId === this.clientId ? '<div class="message-status"><i class="fas fa-check-double"></i></div>' : ''}
        `;
        
        // Add click event for reply
        const replyButton = messageElement.querySelector('.reply-action');
        replyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setupReply(message);
        });
        
        // Add click event for reaction
        const reactButton = messageElement.querySelector('.react-action');
        reactButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showReactionPicker(e, message);
        });
        
        // Add double click to react
        messageElement.addEventListener('dblclick', () => {
            if (message.userId !== this.clientId) {
                this.sendReaction(message, '❤️');
            }
        });
        
        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Add entrance animation
        setTimeout(() => {
            messageElement.classList.add('message-visible');
        }, 10);
    }
    
    displaySystemMessage(text, animated = false) {
        const messagesContainer = this.elements.messagesContainer;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message system-message ${animated ? 'system-animated' : ''}`;
        messageElement.innerHTML = `
            <div class="message-content">
                <i class="fas fa-info-circle"></i>
                ${this.escapeHtml(text)}
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        if (animated) {
            setTimeout(() => {
                messageElement.classList.add('visible');
            }, 10);
        }
    }
    
    updateUserList() {
        const userList = this.elements.userList;
        const userCount = this.elements.userCount;
        
        // Update count with animation
        const currentCount = parseInt(userCount.textContent) || 0;
        const newCount = this.users.size;
        
        if (currentCount !== newCount) {
            userCount.style.transform = 'scale(1.2)';
            setTimeout(() => {
                userCount.style.transform = 'scale(1)';
            }, 300);
        }
        
        userCount.textContent = newCount;
        
        // Clear current list
        userList.innerHTML = '';
        
        if (newCount === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'user-item placeholder';
            placeholder.innerHTML = `
                <div class="user-avatar" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));">
                    <i class="fas fa-users"></i>
                </div>
                <div class="user-info">
                    <span class="user-name">Be the first to join!</span>
                    <span class="user-status">Waiting for users...</span>
                </div>
            `;
            userList.appendChild(placeholder);
            return;
        }
        
        // Sort users: online time descending
        const sortedUsers = Array.from(this.users.values()).sort((a, b) => {
            return (b.onlineSince || 0) - (a.onlineSince || 0);
        });
        
        // Add each user to the list
        sortedUsers.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.dataset.userId = user.id;
            
            // Calculate online duration
            const onlineDuration = user.onlineSince 
                ? this.formatOnlineDuration(Date.now() - user.onlineSince)
                : 'Just now';
            
            userElement.innerHTML = `
                <div class="user-avatar" style="background: linear-gradient(135deg, ${user.color}, ${this.adjustColor(user.color, -20)})">
                    ${user.username.charAt(0).toUpperCase()}
                    ${user.id === this.clientId ? '<span class="user-badge-you">YOU</span>' : ''}
                </div>
                <div class="user-info">
                    <div class="user-name-row">
                        <span class="user-name">${this.escapeHtml(user.username)}</span>
                        ${user.id === this.clientId ? '<span class="user-status-indicator you"></span>' : '<span class="user-status-indicator"></span>'}
                    </div>
                    <span class="user-status">Online for ${onlineDuration}</span>
                </div>
                <div class="user-actions">
                    <button class="user-action mention-action" title="Mention user">
                        <i class="fas fa-at"></i>
                    </button>
                    <button class="user-action profile-action" title="View profile">
                        <i class="fas fa-user"></i>
                    </button>
                </div>
            `;
            
            // Add event listeners for user actions
            const mentionButton = userElement.querySelector('.mention-action');
            mentionButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.mentionUser(user.username);
            });
            
            const profileButton = userElement.querySelector('.profile-action');
            profileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showUserProfile(user.username);
            });
            
            // Add tooltip with join time
            if (user.onlineSince) {
                const joinTime = new Date(user.onlineSince).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                userElement.title = `Joined at ${joinTime}`;
            }
            
            userList.appendChild(userElement);
        });
    }
    
    scrollToBottom(smooth = true) {
        const messagesContainer = this.elements.messagesContainer;
        const scrollOptions = {
            top: messagesContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        };
        
        messagesContainer.scrollTo(scrollOptions);
    }
    
    playNotificationSound(type = 'message') {
        // Only play sound if user is not focused on the chat
        if (!document.hasFocus() || document.hidden) {
            const sound = document.getElementById('notificationSound');
            
            // Different sounds for different events (in a real app)
            switch (type) {
                case 'join':
                    // Could use different sound
                    break;
                case 'leave':
                    // Could use different sound
                    break;
            }
            
            try {
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Audio play failed:', e));
            } catch (error) {
                console.error('Error playing sound:', error);
            }
        }
    }
    
    showNotification(message, type = 'info') {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Add close button event
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    showDesktopNotification(message) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        const notification = new Notification(`💬 ${message.username}`, {
            body: message.text.length > 100 ? message.text.substring(0, 100) + '...' : message.text,
            icon: `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}&background=${message.color?.substring(1) || '4361ee'}&color=fff`,
            badge: '/favicon.ico'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(notification.close.bind(notification), 5000);
    }
    
    formatMessageText(text) {
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const mentionRegex = /@(\w+)/g;
        
        let formatted = this.escapeHtml(text);
        
        // Replace URLs
        formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Replace mentions
        formatted = formatted.replace(mentionRegex, '<span class="mention">@$1</span>');
        
        // Preserve line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 10) {
            return 'just now';
        } else if (diffSec < 60) {
            return `${diffSec}s ago`;
        } else if (diffMin < 60) {
            return `${diffMin}m ago`;
        } else if (diffHour < 24) {
            return `${diffHour}h ago`;
        } else if (diffDay === 1) {
            return 'yesterday';
        } else if (diffDay < 7) {
            return `${diffDay}d ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    formatOnlineDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }
    
    adjustColor(color, amount) {
        // Simple color adjustment for gradients
        const hex = color.replace('#', '');
        const num = parseInt(hex, 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    
    getRandomColor() {
        const colors = [
            '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669',
            '#0891b2', '#4f46e5', '#dc2626', '#ca8a04', '#16a34a'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    mentionUser(username) {
        const input = this.elements.messageInput;
        const currentText = input.value;
        
        if (currentText.trim() === '') {
            input.value = `@${username} `;
        } else {
            input.value = `${currentText} @${username} `;
        }
        
        input.focus();
        this.showNotification(`Mentioned ${username}`, 'info');
    }
    
    setupReply(message) {
        this.replyingTo = {
            messageId: message.id,
            userId: message.userId,
            username: message.username,
            text: message.text
        };
        
        // Show reply indicator
        this.showReplyIndicator(message);
    }
    
    showReplyIndicator(message) {
        // Remove existing reply indicator
        const existingIndicator = document.querySelector('.reply-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'reply-indicator';
        indicator.innerHTML = `
            <div class="reply-indicator-content">
                <div class="reply-header">
                    <i class="fas fa-reply"></i>
                    <span>Replying to ${this.escapeHtml(message.username)}</span>
                </div>
                <div class="reply-preview">
                    ${this.escapeHtml(message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text)}
                </div>
                <button class="reply-cancel" title="Cancel reply">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.querySelector('.message-input-container').prepend(indicator);
        
        // Add event listener for cancel
        indicator.querySelector('.reply-cancel').addEventListener('click', () => {
            this.clearReply();
        });
    }
    
    clearReply() {
        this.replyingTo = null;
        const indicator = document.querySelector('.reply-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    showUserProfile(username) {
        const user = Array.from(this.users.values()).find(u => u.username === username);
        if (!user) return;
        
        // Create profile modal
        const modal = document.createElement('div');
        modal.className = 'user-profile-modal';
        modal.innerHTML = `
            <div class="profile-modal-content">
                <div class="profile-header">
                    <div class="profile-avatar" style="background: linear-gradient(135deg, ${user.color}, ${this.adjustColor(user.color, -20)})">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <h3>${this.escapeHtml(user.username)}</h3>
                    <span class="profile-status">Online</span>
                </div>
                <div class="profile-details">
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>Online for ${this.formatOnlineDuration(Date.now() - (user.onlineSince || Date.now()))}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>Joined ${new Date(user.onlineSince || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="btn-primary mention-profile">
                        <i class="fas fa-at"></i> Mention
                    </button>
                    <button class="btn-secondary close-profile">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.mention-profile').addEventListener('click', () => {
            this.mentionUser(user.username);
            modal.remove();
        });
        
        modal.querySelector('.close-profile').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    showMessageContextMenu(e, messageElement) {
        // Remove existing context menu
        const existingMenu = document.querySelector('.message-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'message-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.pageX}px;
            top: ${e.pageY}px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 180px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.1);
        `;
        
        const messageId = messageElement.dataset.messageId;
        const isOwnMessage = messageElement.classList.contains('own-message');
        
        menu.innerHTML = `
            <button class="context-menu-item" data-action="reply">
                <i class="fas fa-reply"></i> Reply
            </button>
            <button class="context-menu-item" data-action="copy">
                <i class="far fa-copy"></i> Copy Text
            </button>
            ${isOwnMessage ? `
                <button class="context-menu-item" data-action="edit">
                    <i class="far fa-edit"></i> Edit
                </button>
                <button class="context-menu-item" data-action="delete">
                    <i class="far fa-trash-alt"></i> Delete
                </button>
            ` : ''}
            <button class="context-menu-item" data-action="report">
                <i class="fas fa-flag"></i> Report
            </button>
        `;
        
        document.body.appendChild(menu);
        
        // Add event listeners
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleContextMenuAction(action, messageElement, messageId);
                menu.remove();
            });
        });
        
        // Position adjustment to keep menu in viewport
        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (e.pageX - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (e.pageY - rect.height) + 'px';
            }
        }, 0);
    }
    
    hideMessageContextMenu() {
        const menu = document.querySelector('.message-context-menu');
        if (menu) {
            menu.remove();
        }
    }
    
    handleContextMenuAction(action, messageElement, messageId) {
        switch (action) {
            case 'reply':
                const messageData = {
                    id: messageId,
                    username: messageElement.querySelector('.message-sender').textContent,
                    text: messageElement.querySelector('.message-content').textContent
                };
                this.setupReply(messageData);
                break;
                
            case 'copy':
                const text = messageElement.querySelector('.message-content').textContent;
                navigator.clipboard.writeText(text).then(() => {
                    this.showNotification('Message copied to clipboard', 'success');
                });
                break;
                
            case 'edit':
                // Future feature
                this.showNotification('Edit feature coming soon!', 'info');
                break;
                
            case 'delete':
                // Future feature
                this.showNotification('Delete feature coming soon!', 'info');
                break;
                
            case 'report':
                this.showNotification('Message reported', 'info');
                break;
        }
    }
    
    showReactionPicker(e, message) {
        const reactions = ['❤️', '😆', '😮', '😢', '👍', '👎', '🔥', '🎉'];
        
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = `
            <div class="reactions-list">
                ${reactions.map(reaction => `
                    <button class="reaction-option" data-reaction="${reaction}">
                        ${reaction}
                    </button>
                `).join('')}
            </div>
        `;
        
        picker.style.cssText = `
            position: fixed;
            left: ${e.pageX}px;
            top: ${e.pageY}px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            z-index: 1000;
            padding: 8px;
            display: flex;
            gap: 4px;
        `;
        
        document.body.appendChild(picker);
        
        // Add event listeners
        picker.querySelectorAll('.reaction-option').forEach(option => {
            option.addEventListener('click', () => {
                const reaction = option.dataset.reaction;
                this.sendReaction(message, reaction);
                picker.remove();
            });
        });
        
        // Remove picker on outside click
        setTimeout(() => {
            const removePicker = (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', removePicker);
                }
            };
            document.addEventListener('click', removePicker);
        }, 0);
    }
    
    sendReaction(message, reaction) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'reaction',
            messageId: message.id,
            reaction: reaction,
            timestamp: Date.now()
        }));
        
        this.showNotification(`Reacted with ${reaction}`, 'success');
    }
    
    createEmojiPicker() {
        // Simplified emoji picker - in a real app, this would be more comprehensive
        this.elements.emojiButton.addEventListener('click', (e) => {
            const picker = document.createElement('div');
            picker.className = 'emoji-picker';
            picker.innerHTML = `
                <div class="emoji-categories">
                    ${this.emojiCategories.map(category => `
                        <button class="emoji-category" data-category="${category.name}">
                            ${category.emojis[0]}
                        </button>
                    `).join('')}
                </div>
                <div class="emoji-grid">
                    ${this.emojiCategories[0].emojis.map(emoji => `
                        <button class="emoji-option" data-emoji="${emoji}">
                            ${emoji}
                        </button>
                    `).join('')}
                </div>
            `;
            
            const rect = this.elements.emojiButton.getBoundingClientRect();
            picker.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                bottom: ${window.innerHeight - rect.top + 10}px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                z-index: 1000;
                padding: 16px;
                min-width: 300px;
                max-height: 400px;
                overflow-y: auto;
            `;
            
            document.body.appendChild(picker);
            
            // Add event listeners
            picker.querySelectorAll('.emoji-option').forEach(option => {
                option.addEventListener('click', () => {
                    const emoji = option.dataset.emoji;
                    this.insertEmoji(emoji);
                    picker.remove();
                });
            });
            
            // Remove picker on outside click
            setTimeout(() => {
                const removePicker = (e) => {
                    if (!picker.contains(e.target) && e.target !== this.elements.emojiButton) {
                        picker.remove();
                        document.removeEventListener('click', removePicker);
                    }
                };
                document.addEventListener('click', removePicker);
            }, 0);
        });
    }
    
    insertEmoji(emoji) {
        const input = this.elements.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.length;
        
        // Trigger input event for typing indicator
        input.dispatchEvent(new Event('input'));
    }
    
    updateSendButtonState() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
        
        this.elements.sendButton.disabled = !hasText || !isConnected;
        
        if (hasText && isConnected) {
            this.elements.sendButton.style.opacity = '1';
            this.elements.sendButton.style.cursor = 'pointer';
        } else {
            this.elements.sendButton.style.opacity = '0.6';
            this.elements.sendButton.style.cursor = 'not-allowed';
        }
    }
    
    shakeElement(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
    
    markMessagesAsRead() {
        // Update read receipts for own messages
        const messages = this.elements.messagesContainer.querySelectorAll('.own-message .message-status');
        messages.forEach(status => {
            if (!status.classList.contains('read')) {
                status.classList.add('read');
                status.innerHTML = '<i class="fas fa-check-double" style="color: #10b981;"></i>';
            }
        });
    }
    
    // Future feature handlers
    handleMessageReaction(data) {
        // Update message with reaction
        console.log('Reaction received:', data);
    }
    
    handleMessageEdit(data) {
        // Edit existing message
        console.log('Edit received:', data);
    }
    
    handleMessageDelete(data) {
        // Delete message
        console.log('Delete received:', data);
    }
    
    handleImagePaste(blob) {
        // Handle image upload
        this.showNotification('Image paste detected! File upload feature coming soon.', 'info');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    createNotificationStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            @keyframes slideInRight {
                from { 
                    opacity: 0; 
                    transform: translateX(100%); 
                }
                to { 
                    opacity: 1; 
                    transform: translateX(0); 
                }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
            
            .notification {
                position: fixed;
                top: 24px;
                right: 24px;
                padding: 16px 24px;
                border-radius: 12px;
                font-weight: 500;
                box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                backdrop-filter: blur(20px);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(255, 255, 255, 0.2);
                max-width: 400px;
                min-width: 300px;
            }
            
            .notification.success {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(16, 185, 129, 0.85));
                color: white;
            }
            
            .notification.error {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(239, 68, 68, 0.85));
                color: white;
            }
            
            .notification.warning {
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(245, 158, 11, 0.85));
                color: white;
            }
            
            .notification.info {
                background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(37, 99, 235, 0.85));
                color: white;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: auto;
                opacity: 0.7;
                transition: opacity 0.2s;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
            .message-visible {
                animation: messageSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            
            @keyframes messageSlideIn {
                from { 
                    opacity: 0; 
                    transform: translateY(20px) scale(0.95); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    createRippleStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            .btn-primary, .btn-icon {
                position: relative;
                overflow: hidden;
            }
        `;
        document.head.appendChild(styles);
    }
    
    createReplyStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .reply-indicator {
                background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(124, 58, 237, 0.1));
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 12px;
                border: 1px solid rgba(37, 99, 235, 0.2);
                animation: slideUp 0.3s ease;
            }
            
            .reply-indicator-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .reply-header {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                color: var(--primary-color);
                font-size: 14px;
            }
            
            .reply-preview {
                flex: 1;
                font-size: 13px;
                color: var(--gray-600);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .reply-cancel {
                background: none;
                border: none;
                color: var(--gray-500);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }
            
            .reply-cancel:hover {
                background: rgba(0,0,0,0.05);
                color: var(--gray-700);
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .message-reply {
                margin-bottom: 8px;
                padding-left: 16px;
                position: relative;
            }
            
            .reply-line {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 2px;
                background: var(--primary-color);
                border-radius: 1px;
            }
            
            .reply-content {
                background: rgba(0,0,0,0.03);
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 13px;
            }
            
            .reply-username {
                font-weight: 600;
                color: var(--primary-color);
                margin-right: 8px;
            }
            
            .reply-text {
                color: var(--gray-600);
            }
            
            .mention {
                background: rgba(37, 99, 235, 0.1);
                color: var(--primary-color);
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 500;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Initialize chat app
    window.chatApp = new ChatSync();
    
    // Add global error handler
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
    });
    
    // Add beforeunload handler
    window.addEventListener('beforeunload', () => {
        if (window.chatApp.ws && window.chatApp.ws.readyState === WebSocket.OPEN) {
            window.chatApp.ws.close(1000, 'User left');
        }
    });
});
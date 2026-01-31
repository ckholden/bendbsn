/**
 * BSN9B Shared Chat Module
 * This file contains all chat functionality shared across pages
 * Include this after Firebase is initialized
 */

(function() {
    'use strict';

    // Ensure Firebase is available
    if (typeof firebase === 'undefined') {
        console.error('Chat.js: Firebase not loaded');
        return;
    }

    const auth = firebase.auth();
    const database = firebase.database();

    // Firebase References
    const chatRef = database.ref('chat/messages');
    const directMessagesRef = database.ref('directMessages');
    const announcementsRef = database.ref('announcements');
    const presenceRef = database.ref('chat/presence');

    // User info from localStorage
    const currentUsername = localStorage.getItem('bsn9b_user') || 'Anonymous';
    const displayName = localStorage.getItem('bsn9b_displayName') || currentUsername;

    // Chat State
    let chatOpen = false;
    let unreadCount = 0;
    let lastReadTimestamp = parseInt(localStorage.getItem('chatLastRead') || '0');
    let soundEnabled = localStorage.getItem('chatSoundEnabled') !== 'false';
    let notificationsEnabled = localStorage.getItem('chatNotificationsEnabled') === 'true';

    // DM State
    let chatMode = 'group';
    let currentDMConversation = null;
    let dmConversations = [];
    let dmUnreadCount = 0;
    let dmLastReadTimestamps = JSON.parse(localStorage.getItem('dmLastRead') || '{}');

    // Online Users
    let onlineUsers = [];
    let allRegisteredUsers = [];

    // Message retention (7 days)
    const MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

    // Admin emails
    const ADMIN_EMAILS = ['christiankholden@gmail.com', 'holdenc'];

    // ========== AUTH STATE ==========
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('Chat: Firebase Auth logged in as', user.email || user.uid);
        } else {
            console.log('Chat: Firebase Auth not logged in');
            if (localStorage.getItem('bsn9b_auth') === 'true') {
                console.warn('Chat: Session exists but Firebase auth lost');
            }
        }
    });

    // ========== PRESENCE TRACKING ==========
    const myPresence = presenceRef.push();
    myPresence.set({
        name: displayName,
        user: currentUsername,
        online: true,
        timestamp: Date.now()
    });
    myPresence.onDisconnect().remove();

    // Update presence timestamp periodically
    setInterval(() => {
        myPresence.update({ timestamp: Date.now() });
    }, 60000);

    // Listen for online users
    presenceRef.on('value', (snapshot) => {
        onlineUsers = [];
        const count = snapshot.numChildren();
        const onlineCountEl = document.getElementById('onlineCount');
        if (onlineCountEl) {
            onlineCountEl.textContent = count + ' online';
        }
        if (snapshot.exists()) {
            const now = Date.now();
            snapshot.forEach((child) => {
                const data = child.val();
                if (data && data.timestamp && (now - data.timestamp) < 5 * 60 * 1000) {
                    onlineUsers.push(data.name || child.key);
                }
            });
        }
    });

    // Load all registered users
    function loadAllUsers() {
        fetch('https://script.google.com/macros/s/AKfycbwJZ_2LLB4omX9sGWy1HA_GZx71L_evx1UbKnnq0e4Hg4_-lHTN90iAcf0voB-lCbLd/exec?action=getUsers')
            .then(response => response.json())
            .then(data => {
                if (data.success && Array.isArray(data.users)) {
                    allRegisteredUsers = data.users.map(u => ({
                        name: u.name || u.email,
                        firstName: (u.name || u.email).split(' ')[0],
                        email: u.email
                    }));
                }
            })
            .catch(err => console.log('Chat: Could not load users:', err));
    }
    loadAllUsers();

    // ========== NOTIFICATION SOUND ==========
    function playNotificationSound() {
        if (!soundEnabled) return;
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Chat: Audio notification not available');
        }
    }

    // ========== UTILITY FUNCTIONS ==========
    function formatTime(timestamp) {
        try {
            if (!timestamp || typeof timestamp !== 'number') return 'Unknown time';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Invalid time';
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            if (isToday) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            return 'Time error';
        }
    }

    function formatMessageWithMentions(text, isMe) {
        try {
            if (!text || typeof text !== 'string') return '';
            let formatted = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            formatted = formatted.replace(/@(\w+)/g, function(match, name) {
                const bgColor = isMe ? 'rgba(255,255,255,0.3)' : 'rgba(139, 92, 246, 0.2)';
                const textColor = isMe ? '#fff' : '#7c3aed';
                return `<span style="background: ${bgColor}; color: ${textColor}; padding: 1px 6px; border-radius: 10px; font-weight: 600;">@${name}</span>`;
            });
            return formatted;
        } catch (e) {
            return text || '';
        }
    }

    function scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) container.scrollTop = container.scrollHeight;
    }

    // ========== CHAT TOGGLE ==========
    window.toggleChat = function() {
        chatOpen = !chatOpen;
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) return;

        if (chatOpen) {
            chatBox.style.display = 'flex';
            chatBox.style.flexDirection = 'column';
            unreadCount = 0;
            const badge = document.getElementById('chatBadge');
            if (badge) badge.style.display = 'none';
            lastReadTimestamp = Date.now();
            localStorage.setItem('chatLastRead', lastReadTimestamp.toString());
            const input = document.getElementById('chatInput');
            if (input) input.focus();
            scrollToBottom();
        } else {
            chatBox.style.display = 'none';
        }
        const toggle = document.getElementById('chatToggle');
        if (toggle) toggle.style.transform = chatOpen ? 'scale(0.9)' : 'scale(1)';
    };

    // ========== SOUND TOGGLE ==========
    window.toggleChatSound = function() {
        soundEnabled = !soundEnabled;
        localStorage.setItem('chatSoundEnabled', soundEnabled.toString());
        updateSoundToggleUI();
    };

    function updateSoundToggleUI() {
        const btn = document.getElementById('soundToggleBtn');
        if (btn) {
            btn.innerHTML = soundEnabled ? '🔔' : '🔕';
            btn.title = soundEnabled ? 'Sound ON (click to mute)' : 'Sound OFF (click to unmute)';
        }
    }

    // ========== USER LIST TOGGLE ==========
    window.toggleUserList = function() {
        const ul = document.getElementById('userList');
        if (!ul) return;
        ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
        if (ul.style.display === 'block') {
            const namesEl = document.getElementById('userListNames');
            if (namesEl) {
                namesEl.innerHTML = onlineUsers.length > 0
                    ? onlineUsers.map(u => `<div style="padding: 4px 0;">• ${u}</div>`).join('')
                    : '<div style="opacity: 0.7;">No users online</div>';
            }
        }
    };

    // ========== SEND MESSAGE ==========
    window.sendMessage = function(event) {
        event.preventDefault();
        const input = document.getElementById('chatInput');
        if (!input) return;
        const message = input.value.trim();
        if (!message) return;

        // Admin commands
        if (ADMIN_EMAILS.includes(currentUsername.toLowerCase())) {
            if (message.toLowerCase().startsWith('alert/')) {
                const alertMsg = message.substring(6).trim();
                if (alertMsg.toLowerCase() === 'clear') {
                    announcementsRef.child('alert').remove();
                } else if (alertMsg) {
                    announcementsRef.child('alert').set({ message: alertMsg, timestamp: Date.now() });
                }
                input.value = '';
                return;
            }
            if (message.toLowerCase().startsWith('fyi/')) {
                const fyiMsg = message.substring(4).trim();
                if (fyiMsg.toLowerCase() === 'clear') {
                    announcementsRef.child('fyi').remove();
                } else if (fyiMsg) {
                    announcementsRef.child('fyi').set({ message: fyiMsg, timestamp: Date.now() });
                }
                input.value = '';
                return;
            }
            if (message.toLowerCase() === 'chat/clear') {
                chatRef.remove();
                input.value = '';
                return;
            }
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('Chat requires authentication. Please refresh the page or log in again.');
            return;
        }

        chatRef.push({
            user: displayName,
            username: currentUsername,
            text: message,
            timestamp: Date.now()
        }).catch((error) => {
            console.error('Chat: Failed to send message:', error);
            alert('Failed to send message: ' + error.message);
        });

        input.value = '';
    };

    // ========== CHAT LISTENER ==========
    function setupChatListener() {
        chatRef.on('value', (snapshot) => {
            const container = document.getElementById('chatMessages');
            if (!container) return;

            if (!snapshot.exists() || snapshot.numChildren() === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary, #888); font-size: 12px; margin-top: 20px;">No messages yet. Start the conversation!</p>';
                return;
            }

            const allMessages = [];
            snapshot.forEach((child) => {
                allMessages.push(child.val());
            });

            const cutoff = Date.now() - MESSAGE_RETENTION_MS;
            const messages = allMessages.filter(msg => msg.timestamp && msg.timestamp >= cutoff);
            messages.sort((a, b) => a.timestamp - b.timestamp);

            if (messages.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary, #888); font-size: 12px; margin-top: 20px;">No messages yet. Start the conversation!</p>';
                return;
            }

            let html = '';
            let newMessages = 0;

            messages.forEach((msg) => {
                const isMe = msg.user === displayName || msg.username === currentUsername;
                const isNew = msg.timestamp > lastReadTimestamp;
                if (isNew && !chatOpen && !isMe) newMessages++;

                const formattedText = formatMessageWithMentions(msg.text, isMe);
                const mentionsMe = msg.text && msg.text.toLowerCase().includes('@' + displayName.toLowerCase());

                html += `
                    <div style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        <div style="font-size: 10px; color: var(--text-secondary, #888); margin-bottom: 3px;">${isMe ? 'You' : (msg.user || 'Anonymous')}</div>
                        <div style="background: ${mentionsMe && !isMe ? 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' : (isMe ? 'linear-gradient(135deg, #1f4e79 0%, #2d5a87 100%)' : 'var(--chat-msg-other-bg, #e2e8f0)')}; color: ${mentionsMe || isMe ? 'white' : 'var(--text-primary, #333)'}; padding: 10px 14px; border-radius: ${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; max-width: 80%; word-wrap: break-word; font-size: 14px;">
                            ${formattedText}
                        </div>
                        <div style="font-size: 9px; color: var(--text-secondary, #aaa); margin-top: 3px;">
                            ${formatTime(msg.timestamp)}${isMe ? ' <span style="color: #4ade80;" title="Delivered">✓</span>' : ''}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            scrollToBottom();

            if (newMessages > 0 && !chatOpen) {
                const shouldNotify = unreadCount < newMessages;
                unreadCount = newMessages;
                const badge = document.getElementById('chatBadge');
                if (badge) {
                    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    badge.style.display = 'flex';
                }
                if (shouldNotify && messages.length > 0) {
                    const latestMessage = messages[messages.length - 1];
                    if (latestMessage.username !== currentUsername) {
                        playNotificationSound();
                    }
                }
            }
        });
    }

    // ========== DM FUNCTIONS ==========
    function getConversationId(email1, email2) {
        return [email1, email2].sort().join('_').replace(/[.@]/g, '_');
    }

    window.switchChatMode = function(mode) {
        try {
            chatMode = mode;
            const groupView = document.getElementById('groupChatView');
            const dmView = document.getElementById('dmView');
            const tabGroup = document.getElementById('tabGroupChat');
            const tabDM = document.getElementById('tabDM');
            const chatTitle = document.getElementById('chatTitle');
            const onlineCount = document.getElementById('onlineCount');

            if (!groupView || !dmView) return;

            if (mode === 'group') {
                groupView.style.display = 'flex';
                dmView.style.display = 'none';
                if (tabGroup) tabGroup.style.background = 'rgba(255,255,255,0.3)';
                if (tabDM) tabDM.style.background = 'rgba(255,255,255,0.1)';
                if (chatTitle) chatTitle.textContent = 'BSN9B Chat';
                if (onlineCount) onlineCount.style.display = 'block';
                unreadCount = 0;
                const badge = document.getElementById('chatBadge');
                if (badge) badge.style.display = 'none';
                lastReadTimestamp = Date.now();
                localStorage.setItem('chatLastRead', lastReadTimestamp.toString());
            } else {
                groupView.style.display = 'none';
                dmView.style.display = 'flex';
                if (tabGroup) tabGroup.style.background = 'rgba(255,255,255,0.1)';
                if (tabDM) tabDM.style.background = 'rgba(255,255,255,0.3)';
                if (chatTitle) chatTitle.textContent = 'Direct Messages';
                if (onlineCount) onlineCount.style.display = 'none';
                showDMConversationList();
                loadDMConversations();
            }
        } catch (e) {
            console.error('Chat: Error switching mode:', e);
        }
    };

    function showDMConversationList() {
        const list = document.getElementById('dmConversationList');
        const msgView = document.getElementById('dmMessageView');
        const selector = document.getElementById('newDMSelector');
        if (list) list.style.display = 'block';
        if (msgView) msgView.style.display = 'none';
        if (selector) selector.style.display = 'none';
        currentDMConversation = null;
    }

    window.showNewDMSelector = function() {
        const list = document.getElementById('dmConversationList');
        const msgView = document.getElementById('dmMessageView');
        const selector = document.getElementById('newDMSelector');
        const search = document.getElementById('dmUserSearch');
        if (list) list.style.display = 'none';
        if (msgView) msgView.style.display = 'none';
        if (selector) selector.style.display = 'flex';
        if (search) search.value = '';
        loadDMUserList();
    };

    window.hideNewDMSelector = function() {
        showDMConversationList();
    };

    function loadDMUserList() {
        const container = document.getElementById('dmUserList');
        if (!container) return;

        const onlineSet = new Set(onlineUsers.map(u => u.toLowerCase()));
        let users = [];

        onlineUsers.forEach(u => {
            if (u.toLowerCase() !== displayName.toLowerCase()) {
                users.push({ name: u, online: true });
            }
        });

        allRegisteredUsers.forEach(u => {
            const firstName = u.firstName;
            if (!onlineSet.has(firstName.toLowerCase()) && firstName.toLowerCase() !== displayName.toLowerCase()) {
                users.push({ name: firstName, fullName: u.name, email: u.email, online: false });
            }
        });

        renderDMUserList(users);
    }

    window.filterDMUsers = function() {
        const search = (document.getElementById('dmUserSearch')?.value || '').toLowerCase();
        const onlineSet = new Set(onlineUsers.map(u => u.toLowerCase()));
        let users = [];

        onlineUsers.forEach(u => {
            if (u.toLowerCase() !== displayName.toLowerCase() && u.toLowerCase().includes(search)) {
                users.push({ name: u, online: true });
            }
        });

        allRegisteredUsers.forEach(u => {
            const firstName = u.firstName;
            if (!onlineSet.has(firstName.toLowerCase()) && firstName.toLowerCase() !== displayName.toLowerCase() &&
                (firstName.toLowerCase().includes(search) || u.name.toLowerCase().includes(search))) {
                users.push({ name: firstName, fullName: u.name, email: u.email, online: false });
            }
        });

        renderDMUserList(users);
    };

    function renderDMUserList(users) {
        const container = document.getElementById('dmUserList');
        if (!container) return;

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 12px;">No users found</p>';
            return;
        }

        container.innerHTML = users.map(u => `
            <div onclick="startDMConversation('${u.name}')" style="padding: 12px; background: var(--bg-primary, white); border-radius: 10px; margin-bottom: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border, #e2e8f0); transition: all 0.2s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='var(--border, #e2e8f0)'">
                <div><div style="font-weight: 600; color: var(--text-primary, #1a1a2e);">${u.name}${u.fullName && u.fullName !== u.name ? ` <span style="color:var(--text-secondary);font-weight:normal;font-size:12px;">(${u.fullName})</span>` : ''}</div></div>
                ${u.online ? '<span style="font-size: 10px; background: #22c55e; color: white; padding: 2px 8px; border-radius: 10px;">online</span>' : '<span style="font-size: 10px; color: var(--text-secondary);">offline</span>'}
            </div>
        `).join('');
    }

    window.startDMConversation = function(partnerName) {
        currentDMConversation = {
            partnerName: partnerName,
            conversationId: getConversationId(displayName, partnerName)
        };

        const list = document.getElementById('dmConversationList');
        const selector = document.getElementById('newDMSelector');
        const msgView = document.getElementById('dmMessageView');
        const partnerEl = document.getElementById('dmPartnerName');
        const statusEl = document.getElementById('dmPartnerStatus');

        if (list) list.style.display = 'none';
        if (selector) selector.style.display = 'none';
        if (msgView) msgView.style.display = 'flex';
        if (partnerEl) partnerEl.textContent = partnerName;

        const isOnline = onlineUsers.some(u => u.toLowerCase() === partnerName.toLowerCase());
        if (statusEl) {
            statusEl.textContent = isOnline ? 'online' : 'offline';
            statusEl.style.background = isOnline ? '#dcfce7' : 'var(--border, #e2e8f0)';
            statusEl.style.color = isOnline ? '#16a34a' : 'var(--text-secondary, #666)';
        }

        loadDMMessages(currentDMConversation.conversationId);
        markDMAsRead(currentDMConversation.conversationId);
    };

    window.closeDMConversation = function() {
        currentDMConversation = null;
        showDMConversationList();
        loadDMConversations();
    };

    function loadDMConversations() {
        const container = document.getElementById('dmConversations');
        if (!container) return;

        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 12px;">Loading...</p>';

        directMessagesRef.once('value', (snapshot) => {
            dmConversations = [];

            snapshot.forEach((child) => {
                const convId = child.key;
                const data = child.val();
                if (!data) return;

                const participants = data.participants || {};
                const isParticipant = Object.values(participants).some(p =>
                    p && (p.toLowerCase() === displayName.toLowerCase() || p.toLowerCase() === currentUsername.toLowerCase())
                );

                if (isParticipant && data.lastMessage) {
                    let partnerName = '';
                    Object.values(participants).forEach(p => {
                        if (p && p.toLowerCase() !== displayName.toLowerCase() && p.toLowerCase() !== currentUsername.toLowerCase()) {
                            partnerName = p;
                        }
                    });

                    dmConversations.push({
                        conversationId: convId,
                        partnerName: partnerName,
                        lastMessage: data.lastMessage,
                        unread: !dmLastReadTimestamps[convId] || data.lastMessage.timestamp > dmLastReadTimestamps[convId]
                    });
                }
            });

            dmConversations.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
            renderDMConversations();
        });
    }

    function renderDMConversations() {
        const container = document.getElementById('dmConversations');
        if (!container) return;

        if (dmConversations.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 12px; padding: 20px;">No conversations yet.<br>Start a new message!</p>';
            return;
        }

        let totalUnread = 0;
        container.innerHTML = dmConversations.map(conv => {
            const time = conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : '';
            const preview = conv.lastMessage ? (conv.lastMessage.text || '').substring(0, 40) + (conv.lastMessage.text?.length > 40 ? '...' : '') : '';
            const isUnread = conv.unread && conv.lastMessage?.sender !== displayName;
            if (isUnread) totalUnread++;

            return `
                <div onclick="startDMConversation('${conv.partnerName}')" style="padding: 12px; background: ${isUnread ? 'var(--bg-tertiary, #f0f7ff)' : 'var(--bg-primary, white)'}; border-radius: 10px; margin-bottom: 8px; cursor: pointer; border: 1px solid ${isUnread ? '#8b5cf6' : 'var(--border, #e2e8f0)'}; transition: all 0.2s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='${isUnread ? '#8b5cf6' : 'var(--border, #e2e8f0)'}' ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: ${isUnread ? '700' : '600'}; color: var(--text-primary, #1a1a2e); margin-bottom: 4px;">
                                ${isUnread ? '● ' : ''}${conv.partnerName}
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary, #666); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${conv.lastMessage?.sender === displayName ? 'You: ' : ''}${preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                            </div>
                        </div>
                        <div style="font-size: 10px; color: var(--text-secondary, #888); white-space: nowrap; margin-left: 10px;">
                            ${time}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        updateDMBadge(totalUnread);
    }

    function updateDMBadge(count) {
        dmUnreadCount = count;
        const badge = document.getElementById('dmBadge');
        const tabBadge = document.getElementById('dmTabBadge');

        if (count > 0) {
            if (badge) {
                badge.textContent = count > 9 ? '9+' : count;
                badge.style.display = 'flex';
            }
            if (tabBadge) {
                tabBadge.textContent = count;
                tabBadge.style.display = 'inline';
            }
        } else {
            if (badge) badge.style.display = 'none';
            if (tabBadge) tabBadge.style.display = 'none';
        }
    }

    function loadDMMessages(conversationId) {
        const container = document.getElementById('dmMessages');
        if (!container) return;

        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 12px;">Loading messages...</p>';

        const messagesRef = directMessagesRef.child(conversationId + '/messages');
        messagesRef.orderByChild('timestamp').on('value', (snapshot) => {
            if (!snapshot.exists()) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 12px; padding: 20px;">No messages yet. Say hello!</p>';
                return;
            }

            const messages = [];
            snapshot.forEach((child) => {
                messages.push(child.val());
            });

            let html = '';
            messages.forEach(msg => {
                const isMe = msg.senderName === displayName || msg.sender === currentUsername;

                html += `
                    <div style="margin-bottom: 12px; display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        <div style="font-size: 10px; color: var(--text-secondary, #888); margin-bottom: 3px;">${isMe ? 'You' : (msg.senderName || 'Unknown')}</div>
                        <div style="background: ${isMe ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'var(--chat-msg-other-bg, #e2e8f0)'}; color: ${isMe ? 'white' : 'var(--text-primary, #333)'}; padding: 10px 14px; border-radius: ${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; max-width: 80%; word-wrap: break-word; font-size: 14px;">
                            ${(msg.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                        </div>
                        <div style="font-size: 9px; color: var(--text-secondary, #aaa); margin-top: 3px;">
                            ${formatTime(msg.timestamp)}${isMe ? (msg.read ? ' <span style="color: #4ade80;" title="Seen">✓✓</span>' : ' <span style="color: var(--text-secondary);" title="Delivered">✓</span>') : ''}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;

            if (currentDMConversation && currentDMConversation.conversationId === conversationId) {
                markDMAsRead(conversationId, snapshot);
            }
        });
    }

    window.sendDM = function(event) {
        event.preventDefault();
        if (!currentDMConversation) return;

        const input = document.getElementById('dmInput');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('Please log in to send messages.');
            return;
        }

        const conversationId = currentDMConversation.conversationId;
        const partnerName = currentDMConversation.partnerName;

        const messageData = {
            sender: currentUsername,
            senderName: displayName,
            text: text,
            timestamp: Date.now(),
            read: false
        };

        try {
            directMessagesRef.child(conversationId + '/messages').push(messageData);
            directMessagesRef.child(conversationId + '/participants').set({
                user1: displayName,
                user2: partnerName
            });
            directMessagesRef.child(conversationId + '/lastMessage').set({
                text: text,
                timestamp: Date.now(),
                sender: displayName
            });
            input.value = '';
        } catch (e) {
            console.error('Chat: Error sending DM:', e);
            alert('Failed to send message. Please try again.');
        }
    };

    function markDMAsRead(conversationId, snapshot) {
        dmLastReadTimestamps[conversationId] = Date.now();
        localStorage.setItem('dmLastRead', JSON.stringify(dmLastReadTimestamps));

        if (snapshot && snapshot.exists()) {
            snapshot.forEach((child) => {
                const msg = child.val();
                const msgKey = child.key;
                if (msg && !msg.read && msg.senderName !== displayName && msg.sender !== currentUsername) {
                    directMessagesRef.child(conversationId + '/messages/' + msgKey + '/read').set(true);
                }
            });
        }

        let totalUnread = 0;
        dmConversations.forEach(conv => {
            if (conv.conversationId !== conversationId && conv.unread && conv.lastMessage?.sender !== displayName) {
                totalUnread++;
            }
        });
        updateDMBadge(totalUnread);
    }

    // DM Listener for notifications
    function setupDMListener() {
        directMessagesRef.on('child_changed', (snapshot) => {
            try {
                const convId = snapshot.key;
                const data = snapshot.val();
                if (!data) return;

                const participants = data.participants || {};
                const isParticipant = Object.values(participants).some(p =>
                    p && (p.toLowerCase() === displayName.toLowerCase() || p.toLowerCase() === currentUsername.toLowerCase())
                );

                if (!isParticipant) return;

                if (data.lastMessage && data.lastMessage.sender !== displayName) {
                    const lastRead = dmLastReadTimestamps[convId] || 0;
                    if (data.lastMessage.timestamp > lastRead) {
                        if (!chatOpen || chatMode !== 'dm' || currentDMConversation?.conversationId !== convId) {
                            playNotificationSound();
                        }
                        if (chatOpen && chatMode === 'dm' && !currentDMConversation) {
                            loadDMConversations();
                        }
                    }
                }
            } catch (e) {
                console.error('Chat: DM listener error:', e);
            }
        });
    }

    // ========== ANNOUNCEMENTS ==========
    announcementsRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        const alertBanner = document.getElementById('alertBanner');
        const fyiBanner = document.getElementById('fyiBanner');

        if (alertBanner) {
            const alertText = document.getElementById('alertText');
            if (data.alert && data.alert.message) {
                if (alertText) alertText.textContent = data.alert.message;
                alertBanner.style.display = 'block';
                document.body.classList.add('has-alert');
            } else {
                alertBanner.style.display = 'none';
                document.body.classList.remove('has-alert');
            }
        }

        if (fyiBanner) {
            const fyiText = document.getElementById('fyiText');
            if (data.fyi && data.fyi.message) {
                if (fyiText) fyiText.textContent = data.fyi.message;
                fyiBanner.style.display = 'block';
                fyiBanner.style.top = (data.alert && data.alert.message) ? '50px' : '0';
                document.body.classList.add('has-fyi');
            } else {
                fyiBanner.style.display = 'none';
                document.body.classList.remove('has-fyi');
            }
        }
    });

    // ========== CONNECTION MONITORING ==========
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        const connected = snap.val() === true;
        const onlineCountEl = document.getElementById('onlineCount');
        if (connected) {
            console.log('Chat: Firebase connected');
            if (onlineCountEl && onlineCountEl.textContent.includes('Disconnected')) {
                onlineCountEl.textContent = 'Reconnected!';
            }
        } else {
            console.log('Chat: Firebase disconnected');
            if (onlineCountEl) {
                onlineCountEl.innerHTML = '<span style="color: #fca5a5;">Disconnected...</span>';
            }
        }
    });

    // ========== BROWSER NOTIFICATIONS ==========
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            notificationsEnabled = true;
            localStorage.setItem('chatNotificationsEnabled', 'true');
            updateNotificationToggleUI();
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                notificationsEnabled = true;
                localStorage.setItem('chatNotificationsEnabled', 'true');
                updateNotificationToggleUI();
                return true;
            }
        }

        notificationsEnabled = false;
        localStorage.setItem('chatNotificationsEnabled', 'false');
        updateNotificationToggleUI();
        return false;
    }

    function sendBrowserNotification(message) {
        if (!notificationsEnabled || Notification.permission !== 'granted') return;
        if (document.hasFocus() && chatOpen) return;

        try {
            const notification = new Notification('BSN9B Chat', {
                body: `${message.user}: ${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}`,
                tag: 'bsn9b-chat',
                requireInteraction: false
            });

            notification.onclick = function() {
                window.focus();
                if (!chatOpen) window.toggleChat();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
        } catch (e) {
            console.log('Notification error:', e);
        }
    }

    function toggleBrowserNotifications() {
        if (notificationsEnabled) {
            notificationsEnabled = false;
            localStorage.setItem('chatNotificationsEnabled', 'false');
            updateNotificationToggleUI();
        } else {
            requestNotificationPermission();
        }
    }

    function updateNotificationToggleUI() {
        const btn = document.getElementById('notificationToggleBtn');
        if (btn) {
            btn.innerHTML = notificationsEnabled ? '📲' : '📵';
            btn.title = notificationsEnabled ? 'Browser notifications ON' : 'Browser notifications OFF (click to enable)';
        }
    }

    // Expose browser notification toggle
    window.toggleBrowserNotifications = toggleBrowserNotifications;

    // ========== @MENTION AUTOCOMPLETE ==========
    // allRegisteredUsers is defined at top of file
    let mentionDropdownIndex = -1;

    // Fetch all registered users from Google Sheet
    async function fetchAllUsers() {
        try {
            const response = await fetch('https://script.google.com/macros/s/AKfycbwJZ_2LLB4omX9sGWy1HA_GZx71L_evx1UbKnnq0e4Hg4_-lHTN90iAcf0voB-lCbLd/exec?action=getUsers');
            const data = await response.json();
            if (data.success && data.users) {
                allRegisteredUsers = data.users
                    .filter(u => u.name && u.name.trim())
                    .map(u => ({
                        name: u.name.trim(),
                        firstName: u.name.trim().split(' ')[0],
                        email: u.email || ''
                    }));
                console.log('Chat: Loaded', allRegisteredUsers.length, 'users for @mention');
            }
        } catch (e) {
            console.log('Chat: Could not fetch users for @mention:', e);
        }
    }

    function showMentionDropdown(searchTerm) {
        const mentionDropdown = document.getElementById('mentionDropdown');
        if (!mentionDropdown) return;

        const onlineSet = new Set(onlineUsers.map(u => u.toLowerCase()));

        let matches = [];

        // Add online users first (marked as online)
        onlineUsers.forEach(u => {
            if (u.toLowerCase().includes(searchTerm)) {
                matches.push({ name: u, online: true });
            }
        });

        // Add registered users who aren't online
        allRegisteredUsers.forEach(u => {
            const firstName = u.firstName;
            const fullName = u.name;
            if (!onlineSet.has(firstName.toLowerCase()) &&
                (firstName.toLowerCase().includes(searchTerm) || fullName.toLowerCase().includes(searchTerm))) {
                matches.push({ name: firstName, fullName: fullName, online: false });
            }
        });

        // Limit to 8 results
        matches = matches.slice(0, 8);

        if (matches.length === 0) {
            hideMentionDropdown();
            return;
        }

        mentionDropdownIndex = 0;
        mentionDropdown.innerHTML = matches.map((m, i) => `
            <div class="mention-item" data-name="${m.name}"
                 style="padding: 10px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; ${i === 0 ? 'background: var(--bg-secondary, #f0f7ff);' : ''}"
                 onclick="selectMention('${m.name}')"
                 onmouseover="this.style.background='var(--bg-secondary, #f0f7ff)'"
                 onmouseout="this.style.background='${i === mentionDropdownIndex ? 'var(--bg-secondary, #f0f7ff)' : 'transparent'}'">
                <span style="font-weight: 500;">@${m.name}${m.fullName && m.fullName !== m.name ? ' <span style="color:var(--text-secondary, #888);font-weight:normal;">(' + m.fullName + ')</span>' : ''}</span>
                ${m.online ? '<span style="font-size: 10px; background: #22c55e; color: white; padding: 2px 6px; border-radius: 10px;">online</span>' : ''}
            </div>
        `).join('');

        mentionDropdown.style.display = 'block';
    }

    function hideMentionDropdown() {
        const mentionDropdown = document.getElementById('mentionDropdown');
        if (mentionDropdown) {
            mentionDropdown.style.display = 'none';
        }
        mentionDropdownIndex = -1;
    }

    function updateMentionHighlight(items) {
        items.forEach((item, i) => {
            item.style.background = i === mentionDropdownIndex ? 'var(--bg-secondary, #f0f7ff)' : 'transparent';
        });
    }

    function selectMention(name) {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;

        const value = chatInput.value;
        const cursorPos = chatInput.selectionStart;

        // Find the @ symbol position
        const textBeforeCursor = value.substring(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex !== -1) {
            // Replace @partial with @fullname
            const newValue = value.substring(0, atIndex) + '@' + name + ' ' + value.substring(cursorPos);
            chatInput.value = newValue;

            // Move cursor after the mention
            const newCursorPos = atIndex + name.length + 2;
            chatInput.setSelectionRange(newCursorPos, newCursorPos);
        }

        hideMentionDropdown();
        chatInput.focus();
    }

    // Expose selectMention for onclick handlers
    window.selectMention = selectMention;

    // Setup @mention event listeners when DOM is ready
    function setupMentionListeners() {
        const chatInput = document.getElementById('chatInput');
        const mentionDropdown = document.getElementById('mentionDropdown');
        if (!chatInput || !mentionDropdown) return;

        chatInput.addEventListener('input', function(e) {
            const value = this.value;
            const cursorPos = this.selectionStart;

            // Find if we're typing after an @ symbol
            const textBeforeCursor = value.substring(0, cursorPos);
            const atMatch = textBeforeCursor.match(/@(\w*)$/);

            if (atMatch) {
                const searchTerm = atMatch[1].toLowerCase();
                showMentionDropdown(searchTerm);
            } else {
                hideMentionDropdown();
            }
        });

        chatInput.addEventListener('keydown', function(e) {
            if (mentionDropdown.style.display === 'none') return;

            const items = mentionDropdown.querySelectorAll('.mention-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                mentionDropdownIndex = Math.min(mentionDropdownIndex + 1, items.length - 1);
                updateMentionHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                mentionDropdownIndex = Math.max(mentionDropdownIndex - 1, 0);
                updateMentionHighlight(items);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (mentionDropdownIndex >= 0 && items[mentionDropdownIndex]) {
                    e.preventDefault();
                    selectMention(items[mentionDropdownIndex].dataset.name);
                }
            } else if (e.key === 'Escape') {
                hideMentionDropdown();
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!chatInput.contains(e.target) && !mentionDropdown.contains(e.target)) {
                hideMentionDropdown();
            }
        });
    }

    // ========== INITIALIZATION ==========
    setupChatListener();
    setupDMListener();
    fetchAllUsers();

    // Setup mention listeners and notification UI when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setupMentionListeners();
            updateNotificationToggleUI();
            updateSoundToggleUI();
        });
    } else {
        setupMentionListeners();
        updateNotificationToggleUI();
        updateSoundToggleUI();
    }

    console.log('Chat.js: Initialized for user', displayName);

})();

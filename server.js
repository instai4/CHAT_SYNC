const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Determine client path based on environment
let CLIENT_PATH;
const possiblePaths = [
    path.join(__dirname, 'client'),          // Client folder in same directory
    path.join(__dirname, '../client'),       // Client folder in parent directory
    path.join(__dirname, '..', 'client'),    // Alternative parent path
    __dirname                                // Current directory as fallback
];

for (const clientPath of possiblePaths) {
    if (fs.existsSync(path.join(clientPath, 'index.html'))) {
        CLIENT_PATH = clientPath;
        console.log(`Found client files at: ${CLIENT_PATH}`);
        break;
    }
}

if (!CLIENT_PATH) {
    console.log('Warning: Client folder not found, using current directory');
    CLIENT_PATH = __dirname;
}
  
  const extname = path.extname(filePath).toLowerCase();
  
  // Set content type
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  
  let contentType = contentTypes[extname] || 'application/octet-stream';
  
  // Read and serve the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found - serve index.html for SPA routing
        fs.readFile(path.join(CLIENT_PATH, 'index.html'), (err, spaContent) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('404 - Page Not Found', 'utf-8');
          } else {
            res.writeHead(200, { 
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache'
            });
            res.end(spaContent, 'utf-8');
          }
        });
      } else {
        // Server error
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      // Success - set headers
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': extname === '.html' ? 'no-cache' : 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
      };
      
      // Add CORS headers for API routes
      if (process.env.NODE_ENV !== 'production') {
        headers['Access-Control-Allow-Origin'] = '*';
      }
      
      res.writeHead(200, headers);
      res.end(content, 'utf-8');
    }
  });

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  clientTracking: true
});

// Store connected clients and users
const clients = new Map();
const users = new Map();
const messageHistory = [];
const MAX_HISTORY = 200;

// Color palette for users
const USER_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669',
  '#0891b2', '#4f46e5', '#dc2626', '#ca8a04', '#16a34a',
  '#7e22ce', '#0ea5e9', '#84cc16', '#f97316', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#10b981'
];

// Helper function to get a random color
function getRandomColor() {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

// Broadcast message to all clients except one
function broadcast(data, excludeClient = null) {
  const message = JSON.stringify(data);
  clients.forEach((client, id) => {
    if (excludeClient && client.id === excludeClient.id) return;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

// Update user list for all clients
function updateUserList() {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    username: user.username,
    color: user.color,
    onlineSince: user.onlineSince,
    isTyping: user.isTyping || false
  }));
  
  // Broadcast updated user list to all clients
  broadcast({
    type: 'user-list',
    users: userList
  });
}

// Handle new connections
wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  const userColor = getRandomColor();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`New client connected: ${clientId} from ${ip}`);
  
  // Store client connection
  const clientInfo = { 
    id: clientId, 
    ws, 
    username: null, 
    color: userColor,
    ip: ip,
    connectedAt: Date.now(),
    isTyping: false
  };
  
  clients.set(clientId, clientInfo);
  
  // Send initial data to new client
  ws.send(JSON.stringify({
    type: 'init',
    clientId,
    color: userColor,
    users: Array.from(users.values()).map(user => ({
      id: user.id,
      username: user.username,
      color: user.color,
      onlineSince: user.onlineSince
    })),
    messageHistory: messageHistory.slice(-50) // Send last 50 messages
  }));
  
  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join':
          // User is joining with a username
          const username = message.username ? message.username.trim() : '';
          
          // Validate username
          if (!username || username.length < 1 || username.length > 20) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Username must be 1-20 characters'
            }));
            return;
          }
          
          // Check if username is already taken among online users
          const existingUser = Array.from(users.values()).find(
            user => user.username.toLowerCase() === username.toLowerCase()
          );
          
          if (existingUser) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Username is already taken'
            }));
            return;
          }
          
          // Update client info
          clientInfo.username = username;
          clientInfo.joinedAt = Date.now();
          
          // Add to users map
          const user = {
            id: clientId,
            username: username,
            color: userColor,
            onlineSince: Date.now(),
            isTyping: false
          };
          
          users.set(clientId, user);
          
          // Send confirmation to the joining user
          ws.send(JSON.stringify({
            type: 'joined',
            username: username,
            timestamp: Date.now()
          }));
          
          // Broadcast user joined to all other clients
          broadcast({
            type: 'user-joined',
            user: user,
            timestamp: Date.now()
          }, clientInfo);
          
          // Update user list
          updateUserList();
          
          // Add system message about user joining
          const systemMessage = {
            id: uuidv4(),
            type: 'system',
            text: `${username} joined the chat`,
            timestamp: Date.now()
          };
          
          messageHistory.push(systemMessage);
          broadcast(systemMessage);
          
          console.log(`${username} joined the chat`);
          break;
          
        case 'message':
          // Handle new chat message
          const messageUser = users.get(clientId);
          if (!messageUser || !message.text) return;
          
          const chatMessage = {
            id: uuidv4(),
            type: 'message',
            userId: clientId,
            username: messageUser.username,
            text: message.text,
            color: messageUser.color,
            timestamp: Date.now(),
            replyTo: message.replyTo || null
          };
          
          // Add to history (limit to MAX_HISTORY messages)
          messageHistory.push(chatMessage);
          if (messageHistory.length > MAX_HISTORY) {
            messageHistory.shift();
          }
          
          // Broadcast message to all clients
          broadcast(chatMessage);
          
          // Reset typing status
          messageUser.isTyping = false;
          updateUserList();
          
          console.log(`${messageUser.username}: ${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}`);
          break;
          
        case 'typing':
          // Broadcast typing indicator
          const typingUser = users.get(clientId);
          if (!typingUser) return;
          
          // Update typing status
          typingUser.isTyping = message.isTyping;
          updateUserList();
          
          // Broadcast typing indicator to other users
          broadcast({
            type: 'typing',
            userId: clientId,
            username: typingUser.username,
            isTyping: message.isTyping
          }, clientInfo);
          break;
          
        case 'reaction':
          // Handle message reactions
          const reactingUser = users.get(clientId);
          if (!reactingUser || !message.messageId || !message.reaction) return;
          
          // Broadcast reaction to all clients
          broadcast({
            type: 'reaction',
            userId: clientId,
            username: reactingUser.username,
            messageId: message.messageId,
            reaction: message.reaction,
            timestamp: Date.now()
          });
          break;
          
        case 'ping':
          // Respond to ping
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    const client = clients.get(clientId);
    
    if (client && client.username) {
      // Broadcast user left
      broadcast({
        type: 'user-left',
        userId: clientId,
        username: client.username,
        timestamp: Date.now()
      });
      
      // Add system message about user leaving
      const systemMessage = {
        id: uuidv4(),
        type: 'system',
        text: `${client.username} left the chat`,
        timestamp: Date.now()
      };
      
      messageHistory.push(systemMessage);
      broadcast(systemMessage);
      
      console.log(`${client.username} left the chat`);
    }
    
    // Remove from collections
    clients.delete(clientId);
    users.delete(clientId);
    
    // Update user list
    updateUserList();
    
    console.log(`Client ${clientId} disconnected`);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
  
  // Send periodic ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);
  
  ws.on('pong', () => {
    // Connection is alive
  });
  
  // Clear interval on close
  ws.on('close', () => {
    clearInterval(pingInterval);
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║             ChatSync Server Running              ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║ Port: ${PORT}                                        ║`);
  console.log(`║ Host: ${HOST}                                        ║`);
  console.log(`║ Environment: ${process.env.NODE_ENV || 'development'} ║`);
  console.log(`║ URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} ║`);
  console.log(`║ WebSocket: ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log(`\n📡 Server is ready for connections...`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔻 Shutting down server gracefully...');
  
  // Close all WebSocket connections
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1000, 'Server shutting down');
    }
  });
  
  // Close the server
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
  
  // Force shutdown after 5 seconds
  setTimeout(() => {
    console.log('⚠️  Forcing shutdown...');
    process.exit(1);
  }, 5000);
});
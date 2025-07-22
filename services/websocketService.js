const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map to store client connections
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      // Extract token from query string
      const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const userRole = decoded.role;

        // Store client connection
        this.clients.set(userId, {
          ws,
          role: userRole
        });

        // Handle client disconnection
        ws.on('close', () => {
          this.clients.delete(userId);
        });

      } catch (error) {
        ws.close(1008, 'Invalid token');
      }
    });
  }

  // Notify specific user about invoice update
  notifyUser(userId, event, data) {
    const client = this.clients.get(userId);
    if (client) {
      client.ws.send(JSON.stringify({
        event,
        data
      }));
    }
  }

  // Notify all super admins about invoice update
  notifySuperAdmins(event, data) {
    this.clients.forEach((client, userId) => {
      if (client.role === 'superadmin') {
        client.ws.send(JSON.stringify({
          event,
          data
        }));
      }
    });
  }

  // Notify all enterprise admins about invoice update
  notifyEnterpriseAdmins(event, data) {
    this.clients.forEach((client, userId) => {
      if (client.role === 'admin') {
        client.ws.send(JSON.stringify({
          event,
          data
        }));
      }
    });
  }
}

module.exports = new WebSocketService(); 
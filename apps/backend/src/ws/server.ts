import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { WsEvent, WhatsAppInstance } from '@bottoo/shared';

let wss: WebSocketServer;

const HEARTBEAT_INTERVAL = 30_000;

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ noServer: true });

  // Handle upgrade manually to validate JWT before accepting connection
  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      logger.warn('WebSocket connection rejected: no token provided');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      logger.warn('WebSocket connection rejected: invalid token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Heartbeat: ping every 30s, terminate unresponsive clients
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const ext = ws as WebSocket & { isAlive?: boolean };
      if (ext.isAlive === false) {
        ws.terminate();
        return;
      }
      ext.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (ws) => {
    const ext = ws as WebSocket & { isAlive?: boolean };
    ext.isAlive = true;

    ws.on('pong', () => {
      ext.isAlive = true;
    });

    logger.info('WebSocket client connected (authenticated)');

    // Send current status of all instances on connect
    try {
      const result = await pool.query<WhatsAppInstance>(
        'SELECT id, status, qr_code FROM whatsapp_instances'
      );
      for (const instance of result.rows) {
        const event: WsEvent = {
          type: 'instance:status',
          payload: {
            id: instance.id,
            status: instance.status,
            qr_code: instance.qr_code,
          },
        };
        ws.send(JSON.stringify(event));
      }
    } catch (err) {
      logger.error('Error sending initial WS state:', err);
    }

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });
}

export function broadcast(event: WsEvent) {
  if (!wss) return;

  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (err) {
        logger.error('Error sending to WebSocket client, terminating:', err);
        try {
          client.terminate();
        } catch {
          // Already terminated
        }
      }
    }
  });
}

export { wss };

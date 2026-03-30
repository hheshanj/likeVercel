import { Client, ConnectConfig, ClientChannel, SFTPWrapper } from 'ssh2';
import { EventEmitter } from 'events';
import { decrypt } from '../utils/crypto';

interface ConnectionInfo {
  client: Client;
  vpsId: string;
  reconnectAttempts: number;
}

interface DecryptedCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export class SSHManager extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private static instance: SSHManager;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly KEEPALIVE_INTERVAL = 30000;

  static getInstance(): SSHManager {
    if (!SSHManager.instance) {
      SSHManager.instance = new SSHManager();
    }
    return SSHManager.instance;
  }

  private constructor() {
    super();
    // Prevent unhandled 'connection-error' events from crashing the process
    this.on('connection-error', (vpsId: string, err: Error) => {
      console.error(`[SSHManager] Background error for ${vpsId}:`, err.message);
    });
  }

  async connect(
    vpsId: string,
    encryptedCreds: string,
    iv: string,
    authTag: string,
    attempt: number = 0
  ): Promise<Client> {
    // Disconnect existing connection if any (only on first attempt)
    if (attempt === 0 && this.connections.has(vpsId)) {
      await this.disconnect(vpsId);
    }

    const decrypted: DecryptedCredentials = JSON.parse(
      decrypt({ data: encryptedCreds, iv, authTag })
    );

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: (v: Client) => void, v: Client) => {
        if (settled) return;
        settled = true;
        fn(v);
      };
      const settleErr = (fn: (e: Error) => void, e: Error) => {
        if (settled) return;
        settled = true;
        fn(e);
      };

      const client = new Client();
      const connectConfig: ConnectConfig = {
        host: decrypted.host,
        port: decrypted.port || 22,
        username: decrypted.username,
        keepaliveInterval: this.KEEPALIVE_INTERVAL,
        keepaliveCountMax: 3,
        readyTimeout: 20000,
      };

      if (decrypted.password) {
        connectConfig.password = decrypted.password;
      } else if (decrypted.privateKey) {
        connectConfig.privateKey = decrypted.privateKey;
        if (decrypted.passphrase) {
          connectConfig.passphrase = decrypted.passphrase;
        }
      }

      client.on('ready', () => {
        const connInfo: ConnectionInfo = {
          client,
          vpsId,
          reconnectAttempts: 0,
        };

        this.connections.set(vpsId, connInfo);
        this.emit('connected', vpsId);
        settle(resolve, client);
      });

      client.on('error', async (err) => {
        console.error(`[SSH] Error for ${vpsId} (Attempt ${attempt + 1}):`, err.message);
        this.cleanup(vpsId);
        
        // Exponential backoff retry logic
        if (attempt < this.MAX_RECONNECT_ATTEMPTS - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[SSH] Retrying connection to ${vpsId} in ${delay}ms...`);
          setTimeout(async () => {
            try {
              const newClient = await this.connect(vpsId, encryptedCreds, iv, authTag, attempt + 1);
              settle(resolve, newClient);
            } catch (retryErr) {
              settleErr(reject, retryErr as Error);
            }
          }, delay);
        } else {
          this.emit('connection-error', vpsId, err);
          settleErr(reject, err);
        }
      });

      client.on('close', () => {
        console.log(`[SSH] Connection closed for ${vpsId}`);
        this.cleanup(vpsId);
        this.emit('disconnected', vpsId);
      });

      client.on('end', () => {
        this.cleanup(vpsId);
      });

      client.connect(connectConfig);
    });
  }

  async disconnect(vpsId: string): Promise<void> {
    const connInfo = this.connections.get(vpsId);
    if (connInfo) {
      connInfo.client.end();
      this.connections.delete(vpsId);
      this.emit('disconnected', vpsId);
    }
  }

  getConnection(vpsId: string): Client | null {
    const connInfo = this.connections.get(vpsId);
    return connInfo ? connInfo.client : null;
  }

  isConnected(vpsId: string): boolean {
    return this.connections.has(vpsId);
  }

  getConnectedVpsIds(): string[] {
    return Array.from(this.connections.keys());
  }

  async executeCommand(vpsId: string, command: string, timeoutMs: number = 60000): Promise<string> {
    const client = this.getConnection(vpsId);
    if (!client) {
      throw new Error(`No active connection for VPS ${vpsId}`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // If we have a stream, try to close it
        if (activeStream) {
          activeStream.destroy();
        }
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let activeStream: ClientChannel | null = null;

      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }

        activeStream = stream;

        let stdout = '';
        let stderr = '';

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(stderr || `Command exited with code ${code}`));
          }
        });
      });
    });
  }

  async openShell(
    vpsId: string
  ): Promise<ClientChannel> {
    const client = this.getConnection(vpsId);
    if (!client) {
      throw new Error(`No active connection for VPS ${vpsId}`);
    }

    return new Promise((resolve, reject) => {
      console.log(`[SSH] Opening shell for ${vpsId}...`);
      client.shell(
        {
          term: 'xterm-256color',
          cols: 80,
          rows: 24,
        },
        (err, stream) => {
          if (err) {
            console.error(`[SSH] Failed to open shell for ${vpsId}:`, err.message);
            return reject(err);
          }
          console.log(`[SSH] Shell opened successfully for ${vpsId}`);
          resolve(stream);
        }
      );
    });
  }

  async getSftp(vpsId: string): Promise<SFTPWrapper> {
    const client = this.getConnection(vpsId);
    if (!client) {
      throw new Error(`No active connection for VPS ${vpsId}`);
    }

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  private cleanup(vpsId: string): void {
    this.connections.delete(vpsId);
  }

  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [vpsId] of this.connections) {
      promises.push(this.disconnect(vpsId));
    }
    await Promise.all(promises);
  }
}

export const sshManager = SSHManager.getInstance();

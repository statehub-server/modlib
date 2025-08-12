/*
MIT License

Copyright (c) 2025 Olivia Navarro

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { randomUUID } from 'crypto'

export interface ModuleDefinition {
  commands: Command[];
}

export interface Command {
  command: string;
  handlerId: string;
}

export interface ActionMessage {
  id?: string;
  handlerId?: string;
  payload?: any;
  target?: string;
  user?: any;
}

// Get the Statehub API from the VM context
declare const Statehub: {
  // Module registration
  registerCommands: (commands: any[]) => void
  
  // RPC and MPC handling
  onRPCInvoke: (handler: (...args: any[]) => any) => void
  onMpcRequest: (handler: (...args: any[]) => any) => void
  sendMpcRequest: (target: string, command: string, args: any[], id: string) => void
  reply: (msgId: string, payload: any, contentType?: string) => void
  
  // Client communication
  onMessage: (type: string, handler: (payload: any) => any) => void
  sendMessage: (to: string, message: any, shardKey?: string) => void
  onClientConnect: (handler: (payload: any) => any) => void
  onClientDisconnect: (handler: (payload: any) => any) => void
  onWebSocketMessage: (handler: (payload: any) => any) => void
  sendToClient: (clientId: string, message: any) => void
  broadcastToClients: (message: any) => void
  
  // Player tracking
  getOnlinePlayers: () => Map<string, any>
  
  // Database access
  getDatabase: () => any
  
  // Logging
  log: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

/**
 * Logs a message with the specified level
 * @param message - The message to log
 * @param level - The log level (info, warning, error, fatal)
 */
export function log(message: string, level: string = 'info') {
  Statehub.log(message)
}

/**
 * Logs a warning message
 * @param message - The warning message
 */
export const warn = (message: string) => Statehub.warn(message)

/**
 * Logs an error message
 * @param message - The error message
 */
export const error = (message: string) => Statehub.error(message)

/**
 * Logs a fatal error message
 * @param message - The fatal error message
 */
export const fatal = (message: string) => Statehub.error(`FATAL: ${message}`)

/**
 * Sends a message to another module
 * @param target - The target module name
 * @param message - The message to send
 * @param shardKey - Optional shard key for load balancing
 */
export function sendMessage(target: string, message: any, shardKey?: string) {
  Statehub.sendMessage(target, message, shardKey)
}

/**
 * Sets up a handler for receiving messages from other modules
 * @param handler - Function to handle incoming messages
 */
export function onMessage(handler: (payload: { from: string, message: any, shardKey?: string }) => any) {
  Statehub.onMessage('message', handler)
}

/**
 * Sets up a handler for client connect events
 * @param handler - Function to handle client connections
 */
export function onClientConnect(handler: (payload: any) => any) {
  Statehub.onClientConnect(handler)
}

/**
 * Sets up a handler for client disconnect events
 * @param handler - Function to handle client disconnections
 */
export function onClientDisconnect(handler: (payload: any) => any) {
  Statehub.onClientDisconnect(handler)
}

/**
 * Sets up a handler for WebSocket messages
 * @param handler - Function to handle WebSocket messages
 */
export function onWebSocketMessage(handler: (payload: any) => any) {
  Statehub.onWebSocketMessage(handler)
}

/**
 * Sends a message to a specific client
 * @param clientId - The ID of the target client
 * @param message - The message to send
 */
export function sendToClient(clientId: string, message: any) {
  Statehub.sendToClient(clientId, message)
}

/**
 * Broadcasts a message to all connected clients
 * @param message - The message to broadcast
 */
export function broadcastToClients(message: any) {
  Statehub.broadcastToClients(message)
}

/**
 * Gets the database instance for queries
 * @returns Database instance
 */
export function getDatabase() {
  return Statehub.getDatabase()
}

/**
 * Gets a map of online players with their info
 * @returns Map of socket IDs to player info
 */
export function getOnlinePlayers() {
  return Statehub.getOnlinePlayers()
}

// MPC callback storage for handling responses
const mpcCallbacks = new Map<string, (result: any) => void>()

// Set up MPC response handler when Statehub context is available
if (typeof Statehub !== 'undefined') {
  // Listen for MPC responses via the module's event emitter
  try {
    Statehub.onMessage('mpcResponse', (data: { requestId: string, result: any }) => {
      const callback = mpcCallbacks.get(data.requestId)
      if (callback) {
        callback(data.result)
        mpcCallbacks.delete(data.requestId)
      }
    })
  } catch (e) {
    // Statehub context may not be available during compilation
  }
}

/**
 * Initialize module with WebSocket commands
 * @param definition - Module definition with commands
 */
export function initModule(definition: ModuleDefinition) {
  // Register WebSocket commands with the core
  if (definition.commands && definition.commands.length > 0) {
    Statehub.registerCommands(definition.commands)
  }
}

/**
 * Module loaded callback - called immediately in VM context
 * @param cb - Callback function
 */
export function onModuleLoaded(cb: (config?: any) => void | Promise<void>) {
  // Call immediately in VM context
  if (cb) cb()
}

/**
 * Handle RPC invocations (WebSocket commands)
 * @param cb - RPC handler function
 */
export function onRPCInvoke(cb: (action?: ActionMessage) => void | Promise<void>) {
  Statehub.onRPCInvoke(cb)
}

/**
 * Handle MPC (module-to-module) requests
 * @param cb - MPC handler function
 */
export function onMpcRequest(cb: (command: string, ...args: any[]) => any | Promise<any>) {
  Statehub.onMpcRequest(cb)
}

/**
 * Send MPC request to another module
 * @param target - Target module name
 * @param command - Command to execute
 * @param args - Arguments for the command
 * @returns Promise with the result
 */
export function mpc<T = any>(target: string, command: string, ...args: any[]): Promise<T> {
  const id = randomUUID()
  
  return new Promise((resolve) => {
    mpcCallbacks.set(id, resolve)
    Statehub.sendMpcRequest(target, command, args, id)
  })
}

/**
 * Reply to an RPC request
 * @param msgId - Message ID to reply to
 * @param payload - Response payload
 * @param contentType - Optional content type
 */
export function reply(msgId: string, payload: any, contentType: string | null = null) {
  Statehub.reply(msgId, payload, contentType || undefined)
}

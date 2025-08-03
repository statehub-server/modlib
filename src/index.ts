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
  routes: Route[];
  commands: Command[];
}

export interface Route {
  method: string;
  path: string;
  handlerId: string;
  auth: boolean;
}

export interface Command {
  command: string;
  handlerId: string;
  broadcast: boolean;
  auth: boolean;
}

export interface ActionMessage {
  id?: string;
  handlerId?: string;
  payload?: {
    query?: any,
    params?: any,
    body?: any,
    headers?: any,
    user?: any
  } | null
}

export interface InitializationMessage {
  instanceId?: string;
}

type MpcHandler = (command: string, ...args: any[]) => any | Promise<any>
const mpcCallbacks = new Map<string, (result: any) => void>()

let onModuleLoadedCallback: ((config?: InitializationMessage) => void | Promise<void>) | null = null
let onRPCInvokeCallback: ((action?: ActionMessage) => void | Promise<void>) | null = null
let onMpcRequestCallback: MpcHandler | null = null

export function log(message: string, level: string = 'info') {
  process.send?.({
    type: 'log',
    level: level,
    message: message
  })
}

export const warn = (message: string) => log(message, 'warning')
export const error = (message: string) => log(message, 'error') 
export const fatal = (message: string) => log(message, 'fatal')

export function initModule(definition: ModuleDefinition) {
  process.send?.({
    type: 'register',
    payload: definition
  })
}

export function onModuleLoaded(cb: (config?: any) => void | Promise<void>) {
  onModuleLoadedCallback = cb
}

export function onRPCInvoke(cb: (action?: ActionMessage) => void | Promise<void>) {
  onRPCInvokeCallback = cb
}

export function onMpcRequest(cb: MpcHandler) {
  onMpcRequestCallback = cb
}

export function mpc<T = any>(target: string, command: string, ...args: any[]): Promise<T> {
  const id = randomUUID()
  
  return new Promise((resolve) => {
    mpcCallbacks.set(id, resolve)
    
    process.send?.({
      type: 'intermoduleMessage',
      id,
      to: target,
      isResult: false,
      payload: {
        command,
        params: args
      }
    })
  })
}

export function reply(
  msgId: string,
  payload: any,
  contentType: string | null = null
) {
  process.send?.({
    type: 'response',
    id: msgId,
    contentType: contentType? contentType : undefined,
    payload: payload
  })
}

export function query<T = any>(sql: string): Promise<T> {
  const id = randomUUID()
  
  return new Promise((resolve, reject) => {
    const handler = (msg: any) => {
      if (msg.id === id) {
        process.off('message', handler)
        if (msg.type === 'databaseError') {
          reject(new Error(msg.payload))
        } else if (msg.type === 'databaseResult') {
          resolve(msg.payload)
        }
      }
    }
    
    process.on('message', handler)
    process.send?.({
      type: 'databaseQuery',
      id,
      payload: sql
    })
  })
}

process.on('message', async (msg: any) => {
  if (msg.type === 'init' && onModuleLoadedCallback) {
    onModuleLoadedCallback({ ...msg, type: undefined })
  }
  
  if (msg.type === 'invoke'
    && typeof msg.handlerId === 'string'
    && onRPCInvokeCallback
  ) {
    onRPCInvokeCallback({ ...msg, type: undefined })
  }
  
  if (msg.type === 'mpcResponse') {
    const { id, payload } = msg
    const cb = mpcCallbacks.get(id)
    if (cb) {
      cb(payload)
      mpcCallbacks.delete(id)
    }
  }
  
  if (msg.type === 'mpcRequest') {
    const { id, payload } = msg
    const { command, params } = payload
    
    if (onMpcRequestCallback) {
      const result = await onMpcRequestCallback(command, ...(params || []))
      process.send?.({
        type: 'intermoduleMessage',
        id,
        isResult: true,
        payload: {
          result
        }
      })
    }
  }
})

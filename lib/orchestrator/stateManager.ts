// ============================================
// State Manager
// ============================================
// Manages orchestrator state persistence using
// localStorage for small state and IndexedDB for
// large locked contexts.
// ============================================

import type {
  ConversationState,
  OutputReference,
  LockedContext,
  StateStorageConfig,
  DEFAULT_STORAGE_CONFIG,
} from '@/types/orchestrator';
import type { ChatMessage } from '@/types/studio';
import { createOutputReference } from './sourceResolver';

// ============================================
// Default State
// ============================================

const CURRENT_VERSION = 1;

function createDefaultState(): ConversationState {
  return {
    last_outputs: [],
    active_source_id: null,
    active_template_id: null,
    locked_context: null,
    version: CURRENT_VERSION,
    updated_at: Date.now(),
  };
}

// ============================================
// localStorage Manager
// ============================================

const LS_KEY = 'orchestrator_state_v1';

/**
 * Load state from localStorage
 * @returns Conversation state or null
 */
function loadFromLocalStorage(): ConversationState | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as ConversationState;

    // Version migration if needed
    if (parsed.version !== CURRENT_VERSION) {
      // For now, just reset to default on version mismatch
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save state to localStorage
 * @param state - State to save
 */
function saveToLocalStorage(state: ConversationState): void {
  if (typeof window === 'undefined') return;

  try {
    // Don't store locked_context in localStorage (use IndexedDB)
    const toStore: ConversationState = {
      ...state,
      locked_context: null, // Stored separately in IndexedDB
      updated_at: Date.now(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(toStore));
  } catch {
    // Silently fail - localStorage might be full
  }
}

/**
 * Clear localStorage state
 */
function clearLocalStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_KEY);
}

// ============================================
// IndexedDB Manager (for large locked contexts)
// ============================================

const IDB_NAME = 'OrchestratorDB';
const IDB_VERSION = 1;
const IDB_STORE = 'locked_contexts';

/**
 * Open IndexedDB connection
 * @returns Promise resolving to IDBDatabase
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Store locked context in IndexedDB
 * @param context - Locked context to store
 * @param id - Storage key (default: 'current')
 */
async function storeLockedContext(
  context: LockedContext,
  id: string = 'current'
): Promise<void> {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    const store = transaction.objectStore(IDB_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ id, context, updated_at: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();
  } catch {
    // Fallback: try to store in localStorage (may fail for large contexts)
    try {
      localStorage.setItem(`orchestrator_context_${id}`, JSON.stringify(context));
    } catch {
      // Silently fail
    }
  }
}

/**
 * Load locked context from IndexedDB
 * @param id - Storage key (default: 'current')
 * @returns Locked context or null
 */
async function loadLockedContext(id: string = 'current'): Promise<LockedContext | null> {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(IDB_STORE, 'readonly');
    const store = transaction.objectStore(IDB_STORE);

    const result = await new Promise<LockedContext | null>((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result;
        resolve(data?.context || null);
      };
    });

    db.close();
    return result;
  } catch {
    // Fallback: try localStorage
    try {
      const stored = localStorage.getItem(`orchestrator_context_${id}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Clear locked context from IndexedDB
 * @param id - Storage key (default: 'current')
 */
async function clearLockedContext(id: string = 'current'): Promise<void> {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    const store = transaction.objectStore(IDB_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    db.close();
  } catch {
    localStorage.removeItem(`orchestrator_context_${id}`);
  }
}

// ============================================
// State Manager Class
// ============================================

export class OrchestratorStateManager {
  private state: ConversationState;
  private maxOutputs: number;

  constructor(maxOutputs: number = 5) {
    this.maxOutputs = maxOutputs;
    this.state = createDefaultState();
  }

  /**
   * Initialize state from storage
   */
  async initialize(): Promise<void> {
    // Load base state from localStorage
    const storedState = loadFromLocalStorage();
    if (storedState) {
      this.state = storedState;
    }

    // Load locked context from IndexedDB
    const lockedContext = await loadLockedContext();
    if (lockedContext) {
      this.state.locked_context = lockedContext;
    }
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Update last outputs from messages
   * @param messages - All chat messages
   */
  updateOutputs(messages: ChatMessage[]): void {
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    this.state.last_outputs = assistantMessages
      .slice(-this.maxOutputs)
      .reverse()
      .map(createOutputReference);
    this.persist();
  }

  /**
   * Set active source
   * @param sourceId - Source message ID or null
   */
  setActiveSource(sourceId: string | null): void {
    this.state.active_source_id = sourceId;
    this.persist();
  }

  /**
   * Get active source ID
   */
  getActiveSource(): string | null {
    return this.state.active_source_id;
  }

  /**
   * Set active template
   * @param templateId - Template ID or null
   */
  setActiveTemplate(templateId: string | null): void {
    this.state.active_template_id = templateId;
    this.persist();
  }

  /**
   * Get active template ID
   */
  getActiveTemplate(): string | null {
    return this.state.active_template_id;
  }

  /**
   * Set locked context
   * @param context - Locked context or null
   */
  async setLockedContext(context: LockedContext | null): Promise<void> {
    this.state.locked_context = context;
    if (context) {
      await storeLockedContext(context);
    } else {
      await clearLockedContext();
    }
    this.persist();
  }

  /**
   * Get locked context
   */
  getLockedContext(): LockedContext | null {
    return this.state.locked_context;
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.state = createDefaultState();
    clearLocalStorage();
    await clearLockedContext();
  }

  /**
   * Persist state to storage
   */
  private persist(): void {
    this.state.updated_at = Date.now();
    saveToLocalStorage(this.state);
  }
}

// ============================================
// Singleton Instance
// ============================================

let stateManagerInstance: OrchestratorStateManager | null = null;

/**
 * Get or create state manager instance
 * @returns State manager singleton
 */
export function getStateManager(): OrchestratorStateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new OrchestratorStateManager();
  }
  return stateManagerInstance;
}

/**
 * Initialize state manager (call on app startup)
 */
export async function initializeStateManager(): Promise<OrchestratorStateManager> {
  const manager = getStateManager();
  await manager.initialize();
  return manager;
}

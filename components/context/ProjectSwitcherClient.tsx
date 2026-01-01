'use client';

// ============================================
// Project Switcher Client Component (Self-fetching)
// ============================================
// Marketing Laboratory v2.0: Multi-Project Switcher
//
// Self-contained client component that:
// 1. Fetches workspaces and clients on mount
// 2. Displays current context with dropdown
// 3. Persists selection via cookies + API
//
// Use this in client layouts where server components can't be embedded.
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

// ============================================
// Types
// ============================================

interface Workspace {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

interface ContextData {
  context: {
    workspaceId: string | null;
    workspaceName: string | null;
    clientId: string | 'all' | null;
    clientName: string | null;
  };
  availableWorkspaces: Workspace[];
  availableClients: Client[];
  error: string | null;
}

interface ProjectSwitcherClientProps {
  /** Compact mode shows only icons on mobile */
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export function ProjectSwitcherClient({ compact = false }: ProjectSwitcherClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [data, setData] = useState<ContextData | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch context data on mount
  const fetchContextData = useCallback(async () => {
    try {
      const response = await fetch('/api/context/full');
      if (response.ok) {
        const contextData = await response.json();
        setData(contextData);
      }
    } catch (error) {
      console.error('Failed to fetch context:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContextData();
  }, [fetchContextData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Set context via API
  const setContext = async (workspaceId: string | null, clientId: string | 'all' | null) => {
    setIsSwitching(true);
    try {
      const response = await fetch('/api/context/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, clientId }),
      });

      if (response.ok) {
        // Refresh context data and page
        await fetchContextData();
        router.refresh();
        setIsOpen(false);
      } else {
        console.error('Failed to set context');
      }
    } catch (error) {
      console.error('Error setting context:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Handle workspace change
  const handleWorkspaceChange = (workspace: Workspace) => {
    // When changing workspace, reset client to 'all'
    setContext(workspace.id, 'all');
  };

  // Handle client change
  const handleClientChange = (clientId: string | 'all') => {
    if (data?.context.workspaceId) {
      setContext(data.context.workspaceId, clientId);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border text-sm">
        <div className="w-5 h-5 bg-secondary/50 rounded animate-pulse" />
        <div className={`flex items-center gap-1.5 ${compact ? 'hidden sm:flex' : 'flex'}`}>
          <div className="w-16 h-4 bg-secondary/50 rounded animate-pulse" />
          <span className="text-muted-foreground">/</span>
          <div className="w-12 h-4 bg-secondary/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // If no data or no workspace available, show empty state
  if (!data || (!data.context.workspaceId && data.availableWorkspaces.length === 0)) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground text-sm">
        <Icon name="folder" size={14} />
        <span className={compact ? 'hidden sm:inline' : ''}>No workspace</span>
      </div>
    );
  }

  const { context, availableWorkspaces, availableClients } = data;
  const displayWorkspaceName = context.workspaceName || 'Select Workspace';
  const displayClientName = context.clientName || 'All Clients';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`
          flex items-center gap-2 px-2.5 py-1.5 rounded-lg
          bg-secondary/50 hover:bg-secondary/80
          border border-border
          text-sm transition-colors
          ${isSwitching ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        `}
        aria-label="Switch project context"
        aria-expanded={isOpen}
      >
        {/* Workspace Icon */}
        <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
          <Icon name="folder" size={12} className="text-primary" />
        </div>

        {/* Labels */}
        <div className={`flex items-center gap-1.5 min-w-0 ${compact ? 'hidden sm:flex' : 'flex'}`}>
          <span className="font-medium text-foreground truncate max-w-[100px]">
            {displayWorkspaceName}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground truncate max-w-[80px]">
            {displayClientName}
          </span>
        </div>

        {/* Chevron */}
        <Icon
          name="chevronDown"
          size={14}
          className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[280px] max-w-[320px] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Workspaces Section */}
          <div className="p-2 border-b border-border">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Workspace
            </div>
            <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
              {availableWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  disabled={isSwitching}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                    transition-colors disabled:opacity-50
                    ${workspace.id === context.workspaceId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary/60'
                    }
                  `}
                >
                  <Icon
                    name={workspace.id === context.workspaceId ? 'checkCircle' : 'folder'}
                    size={14}
                    className={workspace.id === context.workspaceId ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Clients Section */}
          <div className="p-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Client / Project
            </div>
            <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
              {/* All Clients Option */}
              <button
                onClick={() => handleClientChange('all')}
                disabled={isSwitching}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                  transition-colors disabled:opacity-50
                  ${context.clientId === 'all'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary/60'
                  }
                `}
              >
                <Icon
                  name={context.clientId === 'all' ? 'checkCircle' : 'users'}
                  size={14}
                  className={context.clientId === 'all' ? 'text-primary' : 'text-muted-foreground'}
                />
                <span>All Clients</span>
              </button>

              {/* Individual Clients */}
              {availableClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleClientChange(client.id)}
                  disabled={isSwitching}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                    transition-colors disabled:opacity-50
                    ${client.id === context.clientId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary/60'
                    }
                  `}
                >
                  <Icon
                    name={client.id === context.clientId ? 'checkCircle' : 'user'}
                    size={14}
                    className={client.id === context.clientId ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <span className="truncate">{client.name}</span>
                </button>
              ))}

              {/* Empty state for clients */}
              {availableClients.length === 0 && (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No clients in this workspace
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSwitcherClient;

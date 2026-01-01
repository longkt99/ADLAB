'use client';

// ============================================
// Project Switcher Component
// ============================================
// Marketing Laboratory v2.0: Multi-Project Switcher
//
// Displays current workspace + client context.
// Click to open dropdown for switching.
// Persists selection via cookies + API.
// ============================================

import { useState, useRef, useEffect } from 'react';
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

interface ProjectSwitcherProps {
  currentWorkspaceId: string | null;
  currentWorkspaceName: string | null;
  currentClientId: string | 'all' | null;
  currentClientName: string | null;
  availableWorkspaces: Workspace[];
  availableClients: Client[];
  /** Compact mode shows only icons on mobile */
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export function ProjectSwitcher({
  currentWorkspaceId,
  currentWorkspaceName,
  currentClientId,
  currentClientName,
  availableWorkspaces,
  availableClients,
  compact = false,
}: ProjectSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    setIsLoading(true);
    try {
      const response = await fetch('/api/context/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, clientId }),
      });

      if (response.ok) {
        // Refresh the page to load new context
        router.refresh();
        setIsOpen(false);
      } else {
        console.error('Failed to set context');
      }
    } catch (error) {
      console.error('Error setting context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle workspace change
  const handleWorkspaceChange = (workspace: Workspace) => {
    // When changing workspace, reset client to 'all'
    setContext(workspace.id, 'all');
  };

  // Handle client change
  const handleClientChange = (clientId: string | 'all') => {
    setContext(currentWorkspaceId, clientId);
  };

  // If no workspace is available, show empty state
  if (!currentWorkspaceId && availableWorkspaces.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground text-sm">
        <Icon name="folder" size={14} />
        <span className={compact ? 'hidden sm:inline' : ''}>No workspace</span>
      </div>
    );
  }

  const displayWorkspaceName = currentWorkspaceName || 'Select Workspace';
  const displayClientName = currentClientName || 'All Clients';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-2.5 py-1.5 rounded-lg
          bg-secondary/50 hover:bg-secondary/80
          border border-border
          text-sm transition-colors
          ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
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
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                    transition-colors
                    ${workspace.id === currentWorkspaceId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary/60'
                    }
                  `}
                >
                  <Icon
                    name={workspace.id === currentWorkspaceId ? 'checkCircle' : 'folder'}
                    size={14}
                    className={workspace.id === currentWorkspaceId ? 'text-primary' : 'text-muted-foreground'}
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
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                  transition-colors
                  ${currentClientId === 'all'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary/60'
                  }
                `}
              >
                <Icon
                  name={currentClientId === 'all' ? 'checkCircle' : 'users'}
                  size={14}
                  className={currentClientId === 'all' ? 'text-primary' : 'text-muted-foreground'}
                />
                <span>All Clients</span>
              </button>

              {/* Individual Clients */}
              {availableClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleClientChange(client.id)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm
                    transition-colors
                    ${client.id === currentClientId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary/60'
                    }
                  `}
                >
                  <Icon
                    name={client.id === currentClientId ? 'checkCircle' : 'user'}
                    size={14}
                    className={client.id === currentClientId ? 'text-primary' : 'text-muted-foreground'}
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

export default ProjectSwitcher;

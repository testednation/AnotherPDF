import { useEffect, useCallback } from 'react';

export type WorkspaceTab = 'form' | 'xml' | 'resources' | 'preview' | 'preflight' | 'convert' | 'batch';

export const WORKSPACE_TABS: WorkspaceTab[] = [
  'form',
  'xml',
  'preview',
  'preflight',
  'convert',
  'resources',
  'batch',
];

interface UseGlobalShortcutsOptions {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onSavePdf: () => void;
  onExportXml: () => void;
  onExportJson?: () => void;
  onDownloadZip?: () => void;
  onToggleShortcutsModal: () => void;
  isShortcutsModalOpen?: boolean;
}

export function useGlobalShortcuts({
  activeTab,
  onTabChange,
  onSavePdf,
  onExportXml,
  onExportJson,
  onDownloadZip,
  onToggleShortcutsModal,
  isShortcutsModalOpen = false,
}: UseGlobalShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      const hasMeta = e.metaKey || e.ctrlKey;

      // 1. Save & Export PDF: Cmd+S or Ctrl+S
      if (hasMeta && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSavePdf();
        return;
      }

      // 2. Export XML: Cmd+Shift+S or Ctrl+Shift+S
      if (hasMeta && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        onExportXml();
        return;
      }

      // 3. Export JSON: Cmd+Shift+J or Ctrl+Shift+J
      if (hasMeta && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        e.stopPropagation();
        onExportJson?.();
        return;
      }

      // 4. Download Resources ZIP: Cmd+Shift+Z or Ctrl+Shift+Z
      if (hasMeta && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        onDownloadZip?.();
        return;
      }

      // 5. Tab Toggling with Ctrl+] / Ctrl+[ or Alt+ArrowRight / Alt+ArrowLeft
      if (
        (hasMeta && (e.key === ']' || e.code === 'BracketRight')) ||
        (e.altKey && e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        const currentIndex = WORKSPACE_TABS.indexOf(activeTab);
        const nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
        onTabChange(WORKSPACE_TABS[nextIndex]);
        return;
      }

      if (
        (hasMeta && (e.key === '[' || e.code === 'BracketLeft')) ||
        (e.altKey && e.key === 'ArrowLeft')
      ) {
        e.preventDefault();
        const currentIndex = WORKSPACE_TABS.indexOf(activeTab);
        const prevIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
        onTabChange(WORKSPACE_TABS[prevIndex]);
        return;
      }

      // 6. Direct Jump to Tabs using Alt+1 through Alt+7
      if (e.altKey && !hasMeta && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= WORKSPACE_TABS.length) {
          e.preventDefault();
          onTabChange(WORKSPACE_TABS[num - 1]);
          return;
        }
      }

      // Non-input keybindings
      if (!isInput) {
        // 7. Toggle Keyboard Shortcuts Modal: '?' (Shift + /)
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          onToggleShortcutsModal();
          return;
        }
      }
    },
    [
      activeTab,
      onTabChange,
      onSavePdf,
      onExportXml,
      onExportJson,
      onDownloadZip,
      onToggleShortcutsModal,
      isShortcutsModalOpen,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

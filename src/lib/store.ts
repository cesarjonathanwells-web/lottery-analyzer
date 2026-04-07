import { create } from "zustand";

interface GameStore {
  activeGameId: string;
  setActiveGameId: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  activeGameId: "powerball",
  setActiveGameId: (id) => set({ activeGameId: id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));

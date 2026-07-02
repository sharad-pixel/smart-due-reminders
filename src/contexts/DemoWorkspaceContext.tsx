import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface DemoWorkspaceContextValue {
  isDemoView: boolean;
  setDemoView: (on: boolean) => void;
  toggleDemoView: () => void;
}

const KEY = "recouply.demoWorkspace.view";
const DemoWorkspaceContext = createContext<DemoWorkspaceContextValue | null>(null);

export const DemoWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoView, setIsDemoViewState] = useState(false);

  useEffect(() => {
    try {
      setIsDemoViewState(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  const setDemoView = useCallback((on: boolean) => {
    setIsDemoViewState(on);
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  }, []);

  const toggleDemoView = useCallback(() => setDemoView(!isDemoView), [isDemoView, setDemoView]);

  return (
    <DemoWorkspaceContext.Provider value={{ isDemoView, setDemoView, toggleDemoView }}>
      {children}
    </DemoWorkspaceContext.Provider>
  );
};

export const useDemoWorkspace = () => {
  const ctx = useContext(DemoWorkspaceContext);
  if (!ctx) return { isDemoView: false, setDemoView: () => {}, toggleDemoView: () => {} };
  return ctx;
};

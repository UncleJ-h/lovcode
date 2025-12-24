import { createContext, useContext } from "react";

export interface AppConfig {
  homeDir: string;
  shortenPaths: boolean;
  setShortenPaths: (value: boolean) => void;
  formatPath: (path: string) => string;
}

export const AppConfigContext = createContext<AppConfig>({
  homeDir: "",
  shortenPaths: true,
  setShortenPaths: () => {},
  formatPath: (p) => p,
});

export const useAppConfig = () => useContext(AppConfigContext);

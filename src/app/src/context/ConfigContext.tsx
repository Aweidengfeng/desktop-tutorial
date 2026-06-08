import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { configApi } from '../api/client';
import type { AppConfig } from '../types';

const DEFAULT_CONFIG: AppConfig = {
  env: 'production',
  apiBase: '',
  mapProvider: 'amap',
  mapboxToken: '',
  amapKey: '',
  amapSecurityCode: '',
  stripePublishableKey: '',
  googleClientId: '',
  appleClientId: '',
  sentryDsn: '',
  region: 'us',
};

const ConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    configApi.get()
      .then((res) => setConfig(res.data as AppConfig))
      .catch(() => {
        // 网络不通时使用默认值，保证应用继续渲染
      });
  }, []);

  const value = useMemo(() => config, [config]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}

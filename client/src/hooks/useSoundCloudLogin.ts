import { useEffect, useState, useCallback } from "react";

type SoundCloudAuthState = {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => void;
  refresh: () => Promise<void>;
};

export function useSoundCloudAuth(): SoundCloudAuthState {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/soundcloud/me");

      if (!res.ok) {
        setIsConnected(false);
        return;
      }

      setIsConnected(true);
    } catch (err) {
      setError("Failed to check SoundCloud connection");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = () => {
    window.location.href = "/api/soundcloud/login";
  };

  return {
    isConnected,
    isLoading,
    error,
    connect,
    refresh: checkConnection,
  };
}

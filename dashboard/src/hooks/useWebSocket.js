import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../utils/constants.js';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [roadData, setRoadData] = useState(null);
  const wsRef = useRef(null);
  
  // Store previous and latest frames for smooth interpolation
  const agentsRef = useRef([]);
  const prevAgentsMapRef = useRef(new Map());
  const lastTickTimeRef = useRef(performance.now());
  const tickIntervalRef = useRef(20); // ~50Hz = 20ms

  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let ws;

    const connect = () => {
      if (!mountedRef.current) return;
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        // JSON message (e.g. road_network)
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'road_network') {
              setRoadData(data);
            }
          } catch {
            // Ignore malformed JSON
          }
          return;
        }

        // Binary message: 21 bytes per agent
        // uint32 id (0), uint8 type (4), float32 x (5), float32 y (9), float32 heading (13), float32 speed (17)
        const buf = event.data;
        const count = Math.floor(buf.byteLength / 21);
        if (count === 0) return;

        const now = performance.now();
        const delta = now - lastTickTimeRef.current;
        if (delta > 5 && delta < 200) {
          tickIntervalRef.current = delta;
        }
        lastTickTimeRef.current = now;

        // Save current positions into previous map for interpolation
        const prevMap = prevAgentsMapRef.current;
        prevMap.clear();
        const currentList = agentsRef.current || [];
        for (let i = 0; i < currentList.length; i++) {
          const a = currentList[i];
          if (a) prevMap.set(a.id, { x: a.x, y: a.y, heading: a.heading, speed: a.speed });
        }

        const view = new DataView(buf);
        const next = new Array(count);
        for (let i = 0; i < count; i++) {
          const off = i * 21;
          const id = view.getUint32(off, true);
          const type = view.getUint8(off + 4);
          const x = view.getFloat32(off + 5, true);
          const y = view.getFloat32(off + 9, true);
          const heading = view.getFloat32(off + 13, true);
          const speed = view.getFloat32(off + 17, true);

          const prev = prevMap.get(id);
          next[i] = {
            id,
            type,
            x,
            y,
            heading,
            speed,
            prevX: prev ? prev.x : x,
            prevY: prev ? prev.y : y,
            prevHeading: prev ? prev.heading : heading,
          };
        }
        agentsRef.current = next;
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (ws) ws.close();
    };
  }, []);

  const sendControl = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'control', ...msg }));
    }
  }, []);

  return {
    connected,
    roadData,
    agentsRef,
    lastTickTimeRef,
    tickIntervalRef,
    wsRef,
    sendControl,
  };
}

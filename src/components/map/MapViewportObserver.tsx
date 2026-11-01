"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { MapViewport } from "@/lib/map-viewport";

export default function MapViewportObserver({ onChange }: { onChange: (viewport: MapViewport) => void }) {
  const map = useMap();

  useEffect(() => {
    let active = true;
    let previous: MapViewport | null = null;
    const update = () => {
      if (!active) return;
      const bounds = map.getBounds();
      const next = {
        south: bounds.getSouth(), west: bounds.getWest(),
        north: bounds.getNorth(), east: bounds.getEast(), zoom: map.getZoom(),
      };
      if (previous && Object.keys(next).every((key) => next[key as keyof MapViewport] === previous?.[key as keyof MapViewport])) return;
      previous = next;
      onChange(next);
    };
    map.whenReady(update);
    map.on("moveend zoomend resize", update);
    return () => {
      active = false;
      map.off("moveend zoomend resize", update);
      map.off("load", update);
    };
  }, [map, onChange]);

  return null;
}

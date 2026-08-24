"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BARCELONA_CENTER, STATUS_MAP } from "@/lib/config";
import type { LeadWithTags } from "@/lib/types";

function FitBounds({ leads }: { leads: LeadWithTags[] }) {
  const map = useMap();

  useEffect(() => {
    const points = leads
      .filter((l) => l.lat != null && l.lng != null)
      .map((l) => [l.lat!, l.lng!] as [number, number]);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
    // Solo al montar: no recolocar el mapa cada vez que se filtran leads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export default function LeadsMap({ leads }: { leads: LeadWithTags[] }) {
  const located = leads.filter((l) => l.lat != null && l.lng != null);
  const { resolvedTheme } = useTheme();
  const tileStyle = resolvedTheme === "dark" ? "dark_all" : "light_all";

  return (
    <MapContainer
      center={BARCELONA_CENTER}
      zoom={13}
      scrollWheelZoom
      className="z-0 h-full w-full"
    >
      <TileLayer
        key={tileStyle}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${tileStyle}/{z}/{x}/{y}{r}.png`}
      />
      <FitBounds leads={located} />
      {located.map((lead) => {
        const color =
          STATUS_MAP[lead.status]?.color ?? "#78716c";
        return (
          <CircleMarker
            key={lead.id}
            center={[lead.lat!, lead.lng!]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: color,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div className="min-w-44">
                <p className="m-0 text-sm font-semibold">{lead.name}</p>
                <p
                  className="mt-0.5 mb-1 text-xs font-medium"
                  style={{ color }}
                >
                  {STATUS_MAP[lead.status]?.label}
                  {lead.tags.length > 0 &&
                    ` · ${lead.tags.map((t) => t.name).join(", ")}`}
                </p>
                {(lead.notes || lead.problem) && (
                  <p className="my-1 line-clamp-3 text-xs text-neutral-600">
                    {lead.notes?.trim() || lead.problem}
                  </p>
                )}
                <p className="mt-1.5 mb-0 flex gap-3 text-xs">
                  <Link
                    href={`/leads?open=${lead.id}`}
                    className="font-medium"
                  >
                    Ver ficha →
                  </Link>
                  {lead.instagram && (
                    <a
                      href={`https://instagram.com/${lead.instagram}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram
                    </a>
                  )}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

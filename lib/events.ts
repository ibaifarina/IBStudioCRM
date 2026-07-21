"use client";

export const OPEN_NEW_LEAD_EVENT = "crm:open-new-lead";
export const OPEN_PALETTE_EVENT = "crm:open-palette";

export function openNewLead() {
  window.dispatchEvent(new CustomEvent(OPEN_NEW_LEAD_EVENT));
}

export function openPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

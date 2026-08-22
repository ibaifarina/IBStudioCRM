import type { LeadSortKey, WebsiteStatusKey } from "@/lib/config";

export type Lead = {
  id: number;
  name: string;
  instagram: string | null;
  website: string | null;
  websiteStatus: WebsiteStatusKey;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  problem: string | null;
  notes: string | null;
  status: string;
  contactDate: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type LeadWithTags = Lead & { tags: Tag[] };

export type LeadChangeSet = {
  id: number;
  description: string;
  leadCount: number;
  createdAt: string;
  restoredAt: string | null;
  restoresChangeSetId: number | null;
};

export type MessageTemplate = {
  id: number;
  name: string;
  icon: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadCursor = Pick<
  Lead,
  "id" | "name" | "createdAt" | "updatedAt"
>;

export type LeadSort = LeadSortKey;

export type LeadFilters = {
  search?: string;
  status?: string;
  websiteStatus?: WebsiteStatusKey;
  tagId?: number;
  createdFrom?: string;
  createdTo?: string;
};

export type LeadPage = {
  leads: LeadWithTags[];
  total: number | null;
  nextCursor: LeadCursor | null;
};

export type LeadImportComparable = Pick<
  Lead,
  "name" | "instagram" | "website" | "phone" | "address" | "lat" | "lng"
>;

export type LeadOption = Pick<Lead, "id" | "name" | "instagram">;

export type LeadInput = {
  id?: number;
  name: string;
  instagram?: string | null;
  website?: string | null;
  websiteStatus: WebsiteStatusKey;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  problem?: string | null;
  notes?: string | null;
  status: string;
  contactDate?: string | null;
  followUpDate?: string | null;
  tagIds: number[];
};

export type BulkLeadUpdate = {
  leadIds: number[];
  status?: string;
  websiteStatus?: WebsiteStatusKey;
  tags?: {
    mode: "add" | "remove" | "replace";
    tagIds: number[];
  };
  followUpDate?: string | null;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

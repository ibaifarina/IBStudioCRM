export type Lead = {
  id: number;
  name: string;
  instagram: string | null;
  website: string | null;
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

export type LeadOption = Pick<Lead, "id" | "name" | "instagram">;

export type LeadInput = {
  id?: number;
  name: string;
  instagram?: string | null;
  website?: string | null;
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

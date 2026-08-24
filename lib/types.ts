import type {
  ContactChannelKey,
  LeadSortKey,
  LeadSourceKey,
  NextActionKey,
  StatusKey,
  WebsiteStatusKey,
} from "@/lib/config";

export type LeadActivity = {
  id: number;
  leadId: number;
  type: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
  description: string | null;
  origin: string | null;
  templateId: number | null;
};

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
  status: StatusKey;
  /** Legacy mirror retained for imports and rollback compatibility. */
  statuses: StatusKey[];
  contactedAt: string | null;
  repliedAt: string | null;
  lastContactAt: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  contactChannel: ContactChannelKey | null;
  nextAction: NextActionKey;
  nextActionAt: string | null;
  source: LeadSourceKey;
  googlePlaceId: string | null;
  /** Legacy date mirrors retained during the data migration. */
  contactDate: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  recentActivities: LeadActivity[];
  hasMoreActivity: boolean;
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
  | "id"
  | "name"
  | "createdAt"
  | "updatedAt"
  | "followUpDate"
  | "nextActionAt"
>;

export type LeadSort = LeadSortKey;

export type LeadFilters = {
  search?: string;
  status?: StatusKey;
  nextAction?: NextActionKey;
  actionTiming?: "today" | "overdue";
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
  | "id"
  | "name"
  | "instagram"
  | "website"
  | "phone"
  | "address"
  | "lat"
  | "lng"
  | "googlePlaceId"
> & {
  normalizedPhone?: string | null;
  normalizedInstagram?: string | null;
  websiteDomain?: string | null;
};

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
  status: StatusKey;
  contactedAt?: string | null;
  contactChannel?: ContactChannelKey | null;
  nextAction: NextActionKey;
  nextActionAt?: string | null;
  source?: LeadSourceKey;
  googlePlaceId?: string | null;
  tagIds: number[];
  allowDuplicate?: boolean;
};

export type BulkLeadUpdate = {
  leadIds: number[];
  status?: StatusKey;
  websiteStatus?: WebsiteStatusKey;
  tags?: {
    mode: "add" | "remove" | "replace";
    tagIds: number[];
  };
  nextAction?: NextActionKey;
  nextActionAt?: string | null;
};

export type DuplicateWarning = {
  leadId: number;
  leadName: string;
  reason: string;
  confidence: "strong" | "possible";
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

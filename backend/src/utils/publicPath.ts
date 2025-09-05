import path from "path";

export type MediaBucket = "images" | "videos" | "audio" | "documents" | "others";

export const getBucketByMime = (mimetype: string): MediaBucket => {
  const type = mimetype?.split("/")[0];
  if (type === "image") return "images";
  if (type === "video") return "videos";
  if (type === "audio") return "audio";

  // Documentos comuns
  const docTypes = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];
  if (docTypes.includes(mimetype)) return "documents";

  return "others";
};

export const buildCompanyBase = (companyId: number) => `company${companyId}`;

export const buildContactBase = (companyId: number, contactUuid: string) =>
  path.posix.join(buildCompanyBase(companyId), "contacts", contactUuid);

export const buildContactAvatarPath = (companyId: number, contactUuid: string) =>
  path.posix.join(buildContactBase(companyId, contactUuid), "avatar");

export const buildContactMediaBucketPath = (
  companyId: number,
  contactUuid: string,
  bucket: MediaBucket
) => path.posix.join(buildContactBase(companyId, contactUuid), "media", bucket);

export const buildFilemanagerBucketPath = (
  companyId: number,
  bucket: MediaBucket
) => path.posix.join(buildCompanyBase(companyId), "filemanager", bucket);

export const sanitizeFileName = (name: string) =>
  name
    .replace(/[\/\s]/g, "_")
    .replace(/@/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");

// New helpers for User avatar pathing
export const buildUserBase = (companyId: number, username: string) =>
  path.posix.join(buildCompanyBase(companyId), "users", username);

export const buildUserAvatarRelativePath = (
  companyId: number,
  username: string,
  fileName: string
) => path.posix.join(buildUserBase(companyId, username), fileName);

// Group-based paths
export const buildGroupBase = (companyId: number, groupJid: string) =>
  path.posix.join(buildCompanyBase(companyId), "groups", sanitizeFileName(groupJid));

export const buildGroupAvatarPath = (companyId: number, groupJid: string) =>
  path.posix.join(buildGroupBase(companyId, groupJid), "avatar");

export const buildGroupMediaBucketPath = (
  companyId: number,
  groupJid: string,
  bucket: MediaBucket
) => path.posix.join(buildGroupBase(companyId, groupJid), "media", bucket);

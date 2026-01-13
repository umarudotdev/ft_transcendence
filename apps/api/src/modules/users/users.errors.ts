// =============================================================================
// USERS MODULE ERRORS
// =============================================================================

export type ProfileUpdateError =
  | { type: "USER_NOT_FOUND" }
  | { type: "INVALID_DISPLAY_NAME"; message: string }
  | { type: "DISPLAY_NAME_TAKEN" };

export type AvatarUploadError =
  | { type: "USER_NOT_FOUND" }
  | { type: "INVALID_FILE_TYPE"; allowed: string[] }
  | { type: "FILE_TOO_LARGE"; maxSize: number }
  | { type: "UPLOAD_FAILED" };

export type FriendshipError =
  | { type: "USER_NOT_FOUND" }
  | { type: "CANNOT_FRIEND_SELF" }
  | { type: "ALREADY_FRIENDS" }
  | { type: "REQUEST_PENDING" }
  | { type: "USER_BLOCKED" }
  | { type: "NOT_FRIENDS" }
  | { type: "REQUEST_NOT_FOUND" };

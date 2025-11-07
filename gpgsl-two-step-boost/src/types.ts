// src/types.ts
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  posting_token?: string;
  spamhurdles_pm?: string;
  forum_id?: string;
  session_cookie?: string;
  cookie_expires?: string;
}

export interface SendPmRequest {
  to: string;
  subject: string;
  message: string;
  posting_token: string;
  spamhurdles_pm: string;
  forum_id: string;
  session_cookie: string;
  recipientId: string;
  keepCopy: boolean;
}
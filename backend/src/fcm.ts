export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface FcmSendResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface FcmClient {
  send(message: FcmMessage): Promise<FcmSendResult>;
}
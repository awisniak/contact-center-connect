import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { CccMessage, EndUserServices, SendMessageResponse } from '../types';

/**
 * Service should implement this interface for core features interface
 *
 */
export interface AgentService {
  /**
   * Send message to service
   * @param message
   */
  getEndUserService(req: Request): EndUserServices;

  /**
   * Start new conversation with initial message
   * @param message
   */
  startConversation(
    message: CccMessage,
  ): Promise<AxiosResponse<SendMessageResponse>>;
}
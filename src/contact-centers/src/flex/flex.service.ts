import {
  CccMessage,
  MessageType,
  SendMessageResponse,
} from './../common/types';
import { Service, AgentService } from '../common/interfaces';
import axios, { AxiosResponse } from 'axios';

import { v4 as uuidv4 } from 'uuid';
import { FlexWebhookBody, FlexCustomer } from './types';
import { getCustomer } from '../common/utils/get-customer';
import { InjectMiddlewareApi } from '../middleware-api/decorators';
import { MiddlewareApi } from '../middleware-api/middleware-api';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Scope } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

/* eslint-disable */
const axiosRetry = require('axios-retry');
const qs = require('qs');
/* eslint-disable */
const flexChannelUrl = 'https://flex-api.twilio.com/v1/Channels';
const chatServiceUrl = 'https://chat.twilio.com/v2/Services';
axiosRetry(axios, { retries: 3 });

@Injectable({ scope: Scope.REQUEST })
export class FlexService
  implements
    Service<FlexWebhookBody, FlexWebhookBody, FlexWebhookBody>,
    AgentService
{
  /**
   * @ignore
   */
  private customer: FlexCustomer;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectMiddlewareApi() private readonly middlewareApi: MiddlewareApi,
    private httpService: HttpService,
  ) {
    const base64Customer = this.request.headers['x-pypestream-customer'];
    const integration = this.request.headers['x-pypestream-integration'];
    if (integration !== 'Flex' || typeof base64Customer !== 'string') {
      return;
    }

    const customer: FlexCustomer = getCustomer(base64Customer);
    this.customer = customer;

    if (process.env.NODE_ENV === 'test') {
      return;
    }
  }

  /**
   * @ignore
   */
  private getMessageRequestBody(message: CccMessage) {
    const res = {
      Body: message.message.value,
      From: 'PS User',
    };
    return res;
  }
  /**
   * @ignore
   */
  private getEndConversationRequestBody() {
    const res = {
      Body: 'Automated message: USER LEFT CHAT.',
      From: 'PS User',
    };
    return res;
  }
  /**
   * @ignore
   */
  private startConversationRequestBody(message: CccMessage) {
    const res = {
      FlexFlowSid: this.customer.flexFlowSid,
      Identity: message.conversationId,
      ChatUserFriendlyName: 'PS User',
      ChatFriendlyName: 'PS User',
    };

    return res;
  }

  /**
   * @ignore
   */
  async getConversationIdFromChannelId(channelId: string) {
    const auth = {
      username: this.customer.accountSid,
      password: this.customer.authToken,
    };

    const url = `${chatServiceUrl}/${this.customer.serviceSid}/Channels/${channelId}`;
    const res = await axios.get(url, { auth: auth });
    return res.data.unique_name;
  }

  /**
   * Send message to Flex
   * @param message
   */
  async sendMessage(
    message: CccMessage,
  ): Promise<AxiosResponse<SendMessageResponse>> {
    const auth = {
      username: this.customer.accountSid,
      password: this.customer.authToken,
    };
    // console.log('MEssage: ', message)
    const url = `${chatServiceUrl}/${this.customer.serviceSid}/Channels/${message.conversationId}/Messages`;
    const res = this.httpService.post(
      url,
      qs.stringify(this.getMessageRequestBody(message)),
      { auth: auth },
    );

    return res.toPromise();
  }
  /**
   * End conversation
   * @param conversationId
   */
  async endConversation(conversationId: string): Promise<AxiosResponse<any>> {
    const auth = {
      username: this.customer.accountSid,
      password: this.customer.authToken,
    };

    // Send message to notifiy agent
    const url = `${chatServiceUrl}/${this.customer.serviceSid}/Channels/${conversationId}/Messages`;
    this.httpService.post(
      url,
      qs.stringify(this.getEndConversationRequestBody()),
      { auth: auth },
    );

    // Leave the channel
    const reqUrl = `https://chat.twilio.com/v2/Services/${this.customer.serviceSid}/Channels/${conversationId}/Members/${conversationId}`;

    return this.httpService.delete(reqUrl, { auth: auth }).toPromise();
  }
  /**
   * Start new conversation with initial message
   * @param message
   * @param history pass history of end-user
   */
  async startConversation(
    message: CccMessage,
  ): Promise<AxiosResponse<SendMessageResponse>> {
    const auth = {
      username: this.customer.accountSid,
      password: this.customer.authToken,
    };

    // Create a channel to start conversation
    const res = await axios.post(
      flexChannelUrl,
      qs.stringify(this.startConversationRequestBody(message)),
      { auth: auth },
    );
    const channelId = res.data.sid;
    // Update channel to use conversationID as unniqueName
    const reqUrl = `${chatServiceUrl}/${this.customer.serviceSid}/Channels/${channelId}`;
    return this.httpService
      .post(reqUrl, qs.stringify({ UniqueName: message.conversationId }), {
        auth: auth,
      })
      .toPromise();
  }

  /**
   * Convert posted body to CCC message
   * @param body
   * @param params
   */
  mapToCccMessage(body: FlexWebhookBody): CccMessage {
    const messageId = uuidv4();

    return {
      message: {
        value: body.Body,
        type: MessageType.Text,
        id: messageId,
      },
      sender: {
        username: 'test-agent',
        // username: item.agentInfo.agentName,
      },
      //conversationId: this.getConversationIdFromChannelId(body.ChannelSid),
      conversationId: 'x123',
    };
  }

  /**
   * Determine if request body is new message from Agent
   * @param message
   */
  hasNewMessageAction(message: FlexWebhookBody): boolean {
    return !!message.Body;
  }

  /**
   * Determine if agent is available to receive new message
   * @param message
   */
  isAvailable(skill: string): boolean {
    return !!skill;
  }

  escalate(): boolean {
    return true;
  }
}
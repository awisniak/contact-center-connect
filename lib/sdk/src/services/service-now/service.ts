import {
  CcpMessage,
  ContactCenterProConfig,
  MessageType,
  SendMessageResponse,
  ServiceNowConfig,
} from "./../common/types";
import { Service, GenericWebhookInterpreter } from "./../common/interfaces";
import axios, { AxiosResponse } from "axios";

import { v4 as uuidv4 } from "uuid";
import {
  ServiceNowWebhookBody,
  StartTypingIndicatorType,
  EndTypingIndicatorType,
  StartWaitTimeSpinnerType,
} from "./types";

// eslint-disable-next-line
const axiosRetry = require("axios-retry");

axiosRetry(axios, { retries: 3 });

export class ServiceNowService
  implements
    Service<
      ServiceNowWebhookBody,
      ServiceNowWebhookBody,
      ServiceNowWebhookBody
    >,
    GenericWebhookInterpreter<ServiceNowWebhookBody>
{
  serviceNowConfig: ServiceNowConfig;
  contactCenterProConfig: ContactCenterProConfig;

  /**
   * @ignore
   */
  url: string;

  /**
   *  Constructor
   * @param ccpConfig
   * @param serviceNowConfig
   */
  constructor(
    ccpConfig: ContactCenterProConfig,
    serviceNowConfig: ServiceNowConfig
  ) {
    this.serviceNowConfig = serviceNowConfig;
    this.contactCenterProConfig = ccpConfig;
    this.url = `${serviceNowConfig.instanceUrl}/api/sn_va_as_service/bot/integration`;
  }
  /**
   * @ignore
   */
  private getMessageRequestBody(message: CcpMessage) {
    const requestId = uuidv4();
    return {
      requestId,
      clientSessionId: message.conversationId,
      contextVariables: {
        LiveAgent_mandatory_skills: message.skill,
      },
      message: {
        text: message.message.value,
        typed: true,
        clientMessageId: message.message.id,
      },
      userId: message.conversationId,
    };
  }
  /**
   * @ignore
   */
  private getEndConversationRequestBody(conversationId: string) {
    const res = {
      clientSessionId: conversationId,
      action: "END_CONVERSATION",
      message: {
        text: "",
        typed: true,
      },
      userId: conversationId,
    };
    return res;
  }
  /**
   * @ignore
   */
  private startConversationRequestBody(message: CcpMessage) {
    const requestId = uuidv4();
    const clientMessageId = uuidv4();
    const res = {
      requestId,
      clientSessionId: message.conversationId,
      action: "AGENT",
      contextVariables: {
        LiveAgent_mandatory_skills: message.skill,
      },
      message: {
        text: "",
        typed: true,
        clientMessageId,
      },
      userId: message.conversationId,
    };
    return res;
  }
  /**
   * @ignore
   */
  private switchToAgentRequestBody(message: CcpMessage) {
    const requestId = uuidv4();
    const res = {
      requestId,
      clientSessionId: message.conversationId,
      action: "AGENT",
      contextVariables: {
        LiveAgent_mandatory_skills: message.skill,
      },
      message: {
        text: message.message.value,
        typed: true,
        clientMessageId: message.message.id,
      },
      userId: message.conversationId,
    };
    return res;
  }
  /**
   * Send message to ServiceNow
   * @param message
   */
  async sendMessage(
    message: CcpMessage
  ): Promise<AxiosResponse<SendMessageResponse>> {
    const res = await axios.post(this.url, this.getMessageRequestBody(message));

    return res;
  }
  /**
   * End conversation
   * @param conversationId
   */
  async endConversation(conversationId: string): Promise<AxiosResponse<any>> {
    const res = await axios.post(
      this.url,
      this.getEndConversationRequestBody(conversationId)
    );

    return res;
  }
  /**
   * Start new conversation with initial message
   * @param message
   */
  async startConversation(
    message: CcpMessage
  ): Promise<AxiosResponse<SendMessageResponse>> {
    await axios.post(this.url, this.startConversationRequestBody(message));

    const res = await axios.post(
      this.url,
      this.switchToAgentRequestBody(message)
    );
    return res;
  }
  /**
   * @ignore
   */
  private getTypingRequestBody(conversationId: string, isTyping: boolean) {
    const requestId = uuidv4();

    const res = {
      requestId,
      clientSessionId: conversationId,
      action: isTyping ? "TYPING" : "VIEWING",
      userId: conversationId,
    };
    return res;
  }
  /**
   * @ignore
   */
  private getEndRequestBody(conversationId: string) {
    const requestId = uuidv4();

    const res = {
      requestId,
      clientSessionId: conversationId,
      action: "END_CONVERSATION",
    };
    return res;
  }

  /**
   * Update Typing indicator in agent side
   * @param message
   */

  async sendTyping(
    conversationId: string,
    isTyping: boolean
  ): Promise<AxiosResponse<SendMessageResponse>> {
    if (!conversationId) {
      throw new Error(
        "ServiceNow.sendTyping conversationId param is required parameter"
      );
      return null;
    }
    const res = await axios.post(
      this.url,
      this.getTypingRequestBody(conversationId, isTyping)
    );
    return res;
  }

  /**
   * Convert posted body to CCP message
   * @param body
   * @param params
   */
  mapToCcpMessage(
    body: ServiceNowWebhookBody,
    params: { index: number }
  ): CcpMessage {
    const messageId = uuidv4();
    const { index } = params;
    const item = body.body[index];
    if (item.uiType !== "OutputText") {
      return;
    }
    return {
      message: {
        value: item.value,
        type: MessageType.Text,
        id: messageId,
      },
      sender: {
        username: "test-agent",
        // username: item.agentInfo.agentName,
      },
      conversationId: body.clientSessionId,
    };
  }

  /**
   * Determine if request body has `new message` action
   * @param message
   */
  hasNewMessageAction(message: ServiceNowWebhookBody): boolean {
    const item = message.body.find(
      (item) => item.uiType === "OutputText" && item.group === "DefaultText"
    );
    return !!item;
  }

  /**
   * Determine if request body has `end conversation` action
   * @param message
   */
  hasEndConversationAction(message: ServiceNowWebhookBody): boolean {
    const item = message.body.find(
      (item) =>
        item.uiType === "ActionMsg" &&
        item.actionType === "System" &&
        !item.message.includes("entered")
    );
    return !!item;
  }

  /**
   * Determine if request body has `typing indicator` action
   * @param message
   */
  hasTypingIndicatorAction(message: ServiceNowWebhookBody): boolean {
    const item = message.body.some(
      (item: EndTypingIndicatorType | StartTypingIndicatorType) => {
        const isTypingIndicator =
          item.actionType === "EndTypingIndicator" ||
          item.actionType === "StartTypingIndicator";
        return item.uiType === "ActionMsg" && isTypingIndicator;
      }
    );
    return !!item;
  }
  /**
   * Determine if agent is typing or viewing based on request body
   * @param message
   */
  isTyping(message: ServiceNowWebhookBody): boolean {
    type TypingIndicatorType =
      | EndTypingIndicatorType
      | StartTypingIndicatorType;
    const item = message.body.find((item: TypingIndicatorType) => {
      const isTypingIndicator =
        item.actionType === "EndTypingIndicator" ||
        item.actionType === "StartTypingIndicator";
      return item.uiType === "ActionMsg" && isTypingIndicator;
    });
    return (item as TypingIndicatorType).actionType === "StartTypingIndicator";
  }
  /**
   * Determine if agent is available to receive new message
   * @param message
   */
  isAvailable(skill: string): boolean {
    return !!skill;
  }

  /**
   * Determine if request body has `wait time` info
   * @param message
   */
  hasWaitTime(message: ServiceNowWebhookBody): boolean {
    const item: StartWaitTimeSpinnerType = message.body.find((item) => {
      const spinner = item as StartWaitTimeSpinnerType;
      return spinner.spinnerType === "wait_time";
    }) as StartWaitTimeSpinnerType;
    return !!item;
  }

  /**
   * Return estimated wait time in seconds
   * @param message
   */
  getWaitTime(message: ServiceNowWebhookBody): string {
    const item: StartWaitTimeSpinnerType = message.body.find((item) => {
      const spinner = item as StartWaitTimeSpinnerType;
      return spinner.spinnerType === "wait_time";
    }) as StartWaitTimeSpinnerType;
    return item.waitTime;
  }

  escalate(): boolean {
    return true;
  }
}

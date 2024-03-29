import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  PostEscalateBody,
  PostTypingBody,
  PutMessageBody,
  PutSettingsBody,
} from './dto';

import { Response, Request } from 'express';
import { MessageType, AgentServices } from '../common/types';
import { components, operations } from './types/openapi-types';
import { MiddlewareApiService } from './middleware-api.service';

import { Body } from '@nestjs/common';
import { GenesysService } from '../genesys/genesys.service';
import { AgentFactoryService } from '../agent-factory/agent-factory.service';
import { UseInterceptors } from '@nestjs/common';
import { BodyInterceptor } from '../common/interceptors/body.interceptor';

@UseInterceptors(BodyInterceptor)
@Controller('contactCenter/v1')
export class MiddlewareApiController {
  private readonly logger = new Logger(MiddlewareApiController.name);

  constructor(
    private readonly agentFactoryService: AgentFactoryService,
    private readonly middlewareApiService: MiddlewareApiService,
  ) {}

  @Put('settings')
  async putSettings(
    @Body() body: PutSettingsBody,
  ): Promise<components['schemas']['Setting']> {
    const sendMessageRes = await this.middlewareApiService.putSettings({
      callbackToken: body.callbackToken,
      callbackURL: body.callbackURL,
      integrationName: body.integrationName,
      integrationFields: body.integrationFields,
    });
    return sendMessageRes.data;
  }

  @Get('settings')
  async settings(): Promise<components['schemas']['Setting']> {
    const sendMessageRes = await this.middlewareApiService.getSettings();
    return sendMessageRes.data;
  }

  @Get('/agents/availability')
  async availability(
    @Query() query: operations['checkAgentAvailability']['parameters']['query'],
  ): Promise<components['schemas']['AgentAvailability']> {
    if (!query.skill) {
      throw new HttpException(
        'Skill param is required parameter',
        HttpStatus.BAD_REQUEST,
      );
    }
    const agentService: AgentServices =
      this.agentFactoryService.getAgentService();
    const isAvailable = agentService.isAvailable(query.skill);
    return {
      available: isAvailable,
      estimatedWaitTime: 30,
      status: isAvailable ? 'available' : 'unavailable',
      hoursOfOperation: true,
      queueDepth: 10,
    };
  }

  @Get('/agents/waitTime')
  async waitTime(
    @Query() query: operations['agentWaitTime']['parameters']['query'],
  ): Promise<components['schemas']['WaitTime']> {
    if (!query.skill) {
      throw new HttpException(
        'Skill param is required parameter',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      estimatedWaitTime: 60,
    };
  }

  @Post('/conversations/:conversationId/escalate')
  async escalate(
    @Param('conversationId') conversationId,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: PostEscalateBody,
  ) {
    const historyResponse = await this.middlewareApiService
      .history(conversationId)
      .catch(() => {
        return {
          data: { messages: [] },
        };
      });

    try {
      const agentService: AgentServices =
        this.agentFactoryService.getAgentService();
      const history: string = historyResponse.data.messages
        .reverse()
        .map((m) => `[${m.side}] ${m.content}`)
        .join('\r\n');
      const messageId = uuidv4();
      const message = {
        conversationId: conversationId,
        skill: body.skill,
        message: {
          id: messageId,
          value: history,
          type: MessageType.Text,
        },
        sender: {
          email: 'test@test.com',
          username: body.userId,
        },
      };
      await agentService.startConversation(message);
      const json: components['schemas']['EscalateResponse'] = {
        agentId: 'test-agent',
        escalationId: conversationId,
        /** Estimated wait time in seconds */
        estimatedWaitTime: 0,
        /** The user position in the chat queue. */
        queuePosition: 0,
        /** (accepted, queued) */
        status: 'queued',
      };
      return res.status(HttpStatus.CREATED).json(json);
    } catch (ex) {
      this.logger.error('error in start new conversation ' + ex.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        errors: [ex.message],
        message: ex.message,
      });
    }
  }

  @Post('/conversations/:conversationId/type')
  async type(
    @Req() req: Request,
    @Param('conversationId') conversationId,
    @Res() res: Response,
    @Body() body: PostTypingBody,
  ) {
    const agentService: AgentServices =
      this.agentFactoryService.getAgentService();
    if (!(agentService instanceof GenesysService)) {
      await agentService
        .sendTyping(conversationId, body.typing)
        .catch((err) =>
          this.logger.error('error in sync typing indicator: ' + err.message),
        );
    } else {
      this.logger.log('sync typing indicator is not supported');
    }
    res.status(HttpStatus.NO_CONTENT).end();
  }

  @Put('/conversations/:conversationId/messages/:messageId')
  async message(
    @Param('conversationId') conversationId,
    @Param('messageId') messageId,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: PutMessageBody,
  ) {
    const cccMessage = this.middlewareApiService.mapToCccMessage(body, {
      conversationId,
      messageId,
    });

    const agentService: AgentServices =
      this.agentFactoryService.getAgentService();

    if (!(agentService instanceof GenesysService)) {
      this.logger.log('set typing indicator to false');
      await agentService.sendTyping(conversationId, false);
    }
    try {
      await agentService.sendMessage(cccMessage);
      return res.status(HttpStatus.NO_CONTENT).end();
    } catch (err) {
      this.logger.error(`error in send message to agent: ${err.message}`);
      return res.status(HttpStatus.BAD_REQUEST).end();
    }
  }

  @Post('/conversations/:conversationId/end')
  async conversationEnd(
    @Param('conversationId') conversationId,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const service: AgentServices = this.agentFactoryService.getAgentService();
    if (!(service instanceof GenesysService)) {
      this.logger.log('conversation end: set typing indicator to false');
      await service
        .sendTyping(conversationId, false)
        .catch((err) =>
          this.logger.error(
            'error in set typing indicator to false, Error: ' + err.message,
          ),
        );
    }
    try {
      await service.endConversation(conversationId);
      return res.status(HttpStatus.NO_CONTENT).end();
    } catch (err) {
      this.logger.error('error in: end-conversation action:');
      this.logger.error(err.message);
      return res.status(HttpStatus.BAD_REQUEST).end();
    }
  }
}

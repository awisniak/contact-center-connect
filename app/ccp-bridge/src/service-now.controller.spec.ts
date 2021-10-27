import { Test, TestingModule } from '@nestjs/testing';
import { ServiceNowController } from './service-now.controller';
import { AppService } from './app.service';
import { CcpModule } from '@ccp/nestjs-module';
import {
  MiddlewareApiConfig,
  MiddlewareApiService,
  ContactCenterProConfig,
  ServiceNowConfig,
} from '@ccp/sdk';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

const serviceNowConfig: ServiceNowConfig = {
  instanceUrl: 'https://mock-server.service-now.com',
};

const middlewareApiConfig: MiddlewareApiConfig = {
  instanceUrl: 'https://mock-server.middleware.com',
  token: 'fake token',
};

const ccpConfig: ContactCenterProConfig = {
  instanceUrl: 'https://localhost:3000',
};

describe('ServiceNowController', () => {
  let app: INestApplication;
  let appService: AppService;
  let body;

  beforeEach(async () => {
    let moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ServiceNowController],
      imports: [
        CcpModule.forRoot({
          middlewareApi: middlewareApiConfig,
          ccp: ccpConfig,
          serviceNow: serviceNowConfig,
        }),
      ],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    body = {
      requestId: 'req-123',
      clientSessionId: 'client-session-id-123',
      nowSessionId: 'now-session-id-123',
      message: {
        text: 'Test Message',
        typed: true,
        clientMessageId: 'client-message-id-123',
      },
      userId: 'user-123',
      body: [],
      agentChat: true,
      completed: true,
      score: 1,
    };
    await app.init();
  });

  it('/service-now/webhook (POST) with typing-indicator body', async () => {
    const typingBody = {
      actionType: 'StartTypingIndicator',
      uiType: 'ActionMsg',
    };

    const response = await request(app.getHttpServer())
      .post('/service-now/webhook')
      .set('User-Agent', 'supertest')
      .set('Content-Type', 'application/octet-stream')
      .send(JSON.stringify({ ...body, body: [typingBody] }));

    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toEqual(1);
  });

  it('/service-now/webhook (POST) with typing-indicator and end-conversation body', async () => {
    const typingBody = {
      actionType: 'StartTypingIndicator',
      uiType: 'ActionMsg',
    };

    const endConversationBody = {
      uiType: 'ActionMsg',
      actionType: 'System',
      message: 'ended',
    };

    const response = await request(app.getHttpServer())
      .post('/service-now/webhook')
      .set('User-Agent', 'supertest')
      .set('Content-Type', 'application/octet-stream')
      .send(
        JSON.stringify({ ...body, body: [typingBody, endConversationBody] }),
      );

    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toEqual(2);
  });

  it('/service-now/webhook (POST) with send-message body', async () => {
    const newMessageBody = {
      uiType: 'OutputText',
      group: 'DefaultText',
      value: 'I am new message',
    };

    const response = await request(app.getHttpServer())
      .post('/service-now/webhook')
      .set('User-Agent', 'supertest')
      .set('Content-Type', 'application/octet-stream')
      .send(JSON.stringify({ ...body, body: [newMessageBody] }));

    expect(response.statusCode).toEqual(200);
    expect(response.body.length).toEqual(1);
  });
});
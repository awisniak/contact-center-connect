import { Test, TestingModule } from '@nestjs/testing';
import { GenesysController } from './genesys.controller';
import { CccModule } from '../../ccc-module';
import { GenesysConfig } from '../common/types';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

const genesysConfig: GenesysConfig = {
  instanceUrl: 'https://mock-server.service-now.com',
  token: 'abc-123-token',
  middlewareApiUrl: 'https://mock-server.middleware.com',
};

describe('GenesysController', () => {
  let app: INestApplication;
  let body;

  beforeEach(async () => {
    let moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GenesysController],
      imports: [
        CccModule.forRoot({
          enableLog: true,
        }),
      ],
      providers: [],
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
      clientVariables: genesysConfig,
    };
    await app.init();
  });

  describe('/service-now/webhook (POST)', () => {
    let postAction = () =>
      request(app.getHttpServer())
        .post('/service-now/webhook')
        .set('User-Agent', 'supertest')
        .set('Content-Type', 'application/octet-stream');

    it('typing-indicator body', async () => {
      const typingBody = {
        actionType: 'StartTypingIndicator',
        uiType: 'ActionMsg',
      };

      const response = await postAction().send(
        JSON.stringify({
          ...body,
          body: [typingBody],
        }),
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body.length).toEqual(1);
    });

    it('typing-indicator and end-conversation body', async () => {
      const typingBody = {
        actionType: 'StartTypingIndicator',
        uiType: 'ActionMsg',
      };

      const endConversationBody = {
        uiType: 'ActionMsg',
        actionType: 'System',
        message: 'ended',
      };

      const response = await postAction().send(
        JSON.stringify({ ...body, body: [typingBody, endConversationBody] }),
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body.length).toEqual(2);
    });

    it('with send-message body', async () => {
      const newMessageBody = {
        uiType: 'OutputText',
        group: 'DefaultText',
        value: 'I am new message',
      };

      const response = await postAction().send(
        JSON.stringify({ ...body, body: [newMessageBody] }),
      );

      expect(response.statusCode).toEqual(200);
      expect(response.body.length).toEqual(1);
    });

    it('Bad body', async () => {
      const response = await postAction().send(
        JSON.stringify({ ...body, score: null }),
      );

      expect(response.statusCode).toEqual(400);
    });

    it('Empty body', async () => {
      const response = await postAction().send(JSON.stringify({}));

      expect(response.statusCode).toEqual(400);
    });

    it('No body', async () => {
      const response = await postAction();

      expect(response.statusCode).toEqual(400);
    });
  });
});

# Contact Center Sample App
The sample app implements [Pypestream's Contact Center API](https://developers.pypestream.com/reference/contact-center-api-overview) functions such as escalating a conversation to an agent based on skills, sending and receiving messages and indicating when a user is typing.


# Prerequisites
- Create an account with Pypestream
- Create an account with a Contact Center


# Contact Center Pro
- [Technology](#technology)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Test](#test)
- Docs:
    - [Add new service](/docs/add-new-service.md)
    - [Configure serviceNow instance](/docs/configure-serviceNow-instance.md)
    - [Modules structure](/docs/modules-structure.md)
    - [SDK documentation](https://ccc.claybox.usa.pype.engineering/docs/modules.html)

### Technology

- **NestJS**: NestJS is a progressive Node.js framework for building efficient, reliable and scalable server-side applications. 
- **TypeScript**: TypeScript is a strongly typed programming language which builds on JavaScript.
- **NodeJS**: Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine. `v16.6.1`
- **NPM**: npm is the package manager for Node.js. `v7`


## Installation

```bash
$ npm install
$ npm build
```

## Running the app
to receive webhook from your local env you will need to install [ngrok](https://ngrok.com/)

ngrok exposes local servers behind NATs and firewalls to the public internet over secure tunnels.
 
to use ngrok as webhook endpint follow [docs](/docs/configure-serviceNow-instance.md)


```bash
# bind ngrok to port
./ngrok http 3000


# start with watch mode
# in project root folder
$ npm run start:dev


# start with prod mode
# in project root folder
$ npm run start:prod


```
## Config Services
To config end-user and agent services, update the following lines

```ts
    // app/ccsp-bridge/src/app.module.js
    CccModule.forRoot({
      ccc: {
        instanceUrl: 'https://enhvq0q28akbhlm.m.pipedream.net',
      },
      serviceNowCuso: {
        instanceUrl: 'https://dev50996.service-now.com',
      },
      middlewareApi: {
        instanceUrl: 'https://middleware.claybox.usa.pype.engineering',
        token:
          'ydeHKGvMxhpMOeUqvgFG//jdsauXvpFqySTa740KsBdWMSc+3iNBdNRjGLHJ6frY',
      },
    }),
````

## Test

```bash
# unit tests
# in project root folder
$ npm run test
```

## License
All sample applications and code are made available to you for informational purposes only and any use is at your own risk. Pypestream makes no representation or warranty regarding their accuracy, reliability or use and makes no commitment that they will be free of inaccuracies, errors, bugs or interruptions. Pypestream will not be liable for any claims, damages or liability related to the sample applications and code or your use of them.

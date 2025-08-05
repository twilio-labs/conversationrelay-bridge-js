# conversationrelay-bridge-js

This repo creates a Fastify server that acts as a bridge between ConversationRelay and Twilio. It exposes a TwiML endpoint to create the `<Connect>` verb for ConversationRelay. It also exposes a WebSocket for connecting to ConversationRelay. You can then implement your own logic for incoming and outgoing messages to add your own logic.

## Usage

### Create the server

```javascript
import { createCRServer } from "@twilio-labs/conversationrelay-bridge";
import { twimlHandler } from "./twimlHandler";
import { CRSession } from "./CRSession";

const server = await createCRServer({
  twiml: twimlHandler,
  crSession: CRSession,
});
await server.listen({ port: server.config.PORT, host: "0.0.0.0" });
```

### Available Endpoint Handlers

#### TwiML Handler (/twiml)

```typescript
import { FastifyRequest, FastifyReply } from "fastify";

export default function twimlHandler(req: FastifyRequest, reply: FastifyReply) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Connect>
      <ConversationRelay
        url="wss://${req.server.config.NGROK_DOMAIN}/ws"
        welcomeGreeting="Hello! I'm your AI assistant. How can I help you today?"
      />
    </Connect>
  </Response>`;

  req.log.info("TwiML requested, returning ConversationRelay configuration");
  reply.type("text/xml").send(twiml);
}
```

#### Messages Handler (/messages)

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { FlowiseClient } from "../clients";
import CRSession from "../CRSession";

export default async function messageHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const body = req.body as Record<string, string>;
  const flowiseClient = req.diScope.resolve<FlowiseClient>("flowiseClient");
  const session: CRSession = await req.diScope.resolve("getActiveSession")();

  // send message etc
}
```

### CRSession

This is the main class for managing the ConversationRelay session.

```javascript
import {
  ConversationRelaySession,
  PromptMessage,
  DTMFMessage,
  SetupMessage,
  InterruptMessage,
  ErrorMessage,
  TextMessage,
} from "@twilio-labs/conversationrelay-bridge/dist/session";

export default class CRSession extends ConversationRelaySession {
  // Handle messages
  async handleSetup(message: SetupMessage): Promise<void> {}
  async handlePrompt(event: PromptMessage): Promise<void> {}
  async handleInterrupt(message: InterruptMessage): Promise<void> {}
  async handleDTMF(event: DTMFMessage): Promise<void> {}
  async handleError(message: ErrorMessage): Promise<void> {}
}
```

The `handleSetup` method is internally managed for you, and sets the `this.session` parameter with `SetupMessage` as well as `startTime`.

You can send messages using the aux methods:

```javascript
/**
 * Sends a token message to the client.
 * @param token   the token to send
 * @param last  whether this is the last token in the sequence
 * @param additional  additional properties to include in the message
 */
(token: string, last = false, additional?: Omit<TextMessage, 'type' | 'token' | 'last'>)

/**
 * Plays a media file to the client.
 * @param source  the source of the media file
 * @param additional  additional properties to include in the message
 */
play(source: string, additional?: Omit<PlayMessage, 'type' | 'source'>)

/**
 * Sends a digit to the client.
 * @param digits  the digit to send
 */
sendDigits(digits: string)

/**
 * Changes the language of the client.
 * @param language  the language to change to
 */
language(language: Omit<LanguageMessage, 'type'>)

/**
 * Ends the session.
 * @param handoffData  optional data to pass to the handoff
 */
public end(handoffData?: string)
```

### Dependency Injection

This repo uses [awilix](https://github.com/jeffijoe/awilix) for dependency injection. To use it, import `import { diContainer } from "@twilio-labs/conversationrelay-bridge"`.

By default, the following are registered as singleton values:

- `logger`
- `GLOBAL_CONFIG`


### Getting the Active Session

By default, the `From` number is used as the session key. This can be modified by setting `sessionIdKey` to `From | CallSid | SessionId` in the server configuration:

```typescript
const server = await createCRServer({
  twiml: twimlHandler,
  crSession: CRSession,
  sessionIdKey: 'CallSid`,
});
```

To get the active session, you can use `await req.diScope.resolve("getActiveSession")()`. This will by default try to find the sessionKey from the req body parameter. You can pass the sessionKey as the argument if you already have it.


__NOTE__: The session management is very rudemenatory and uses in-memory storage. It is _not_ recommended for production use.

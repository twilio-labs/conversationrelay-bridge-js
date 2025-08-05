import { FastifyBaseLogger } from "fastify";
import WebSocket from "ws";

export type ActiveSessions = Map<string, ConversationRelaySession>;

export type SessionIdKey = "From" | "CallSid" | "SessionId";

export type SetupMessage = {
  type: "setup";
  callSid: string;
  sessionId: string;
  accountSid: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  customParameters: Record<string, string>;
};

export type PromptMessage = {
  type: "prompt";
  voicePrompt: string;
  lang: string;
  last: boolean;
};

export type InterruptMessage = {
  type: "interrupt";
  utteranceUntilInterrupt: string;
  durationUntilInterruptMs: number;
};

export type DTMFMessage = {
  type: "dtmf";
  digit: string;
};

export type ErrorMessage = {
  type: "error";
  description: string;
};

type InboundMessages =
  | SetupMessage
  | PromptMessage
  | InterruptMessage
  | DTMFMessage
  | ErrorMessage;

export type TextMessage = {
  type: "text";
  token: string;
  last?: boolean;
  lang?: string;
  interruptible?: boolean;
  preemptible?: boolean;
};

export type PlayMessage = {
  type: "play";
  source: string;
  loop?: number;
  preemptible?: boolean;
  interruptible?: boolean;
};

export type SendDigitsMessage = {
  type: "sendDigits";
  digits: string;
};

export type LanguageMessage = {
  type: "language";
  ttsLanguage?: string;
  transcriptionLanguage?: string;
};

export type EndMessage = {
  type: "end";
  handoffData?: string;
};

type OutboundMessage =
  | TextMessage
  | PlayMessage
  | SendDigitsMessage
  | LanguageMessage
  | EndMessage;

export type ConversationRelaySessionArgs = {
  connection: WebSocket;
  logger: FastifyBaseLogger;
  requestId: string;
};

export type Session = Omit<SetupMessage, "type"> & {
  startTime: Date;
};

export class ConversationRelaySession {
  private readonly connection: WebSocket;
  protected logger: FastifyBaseLogger;
  protected session: Session;

  public constructor(args: ConversationRelaySessionArgs) {
    this.connection = args.connection;
    this.logger = args.logger;
    this.session = {
      startTime: new Date(),
      sessionId: "",
      callSid: "",
      accountSid: "",
      from: "",
      to: "",
      direction: "inbound",
      customParameters: {},
    };
  }

  public start(handleSetup?: (message: SetupMessage) => Promise<void>) {
    this.connection.on("message", async (data: Buffer) => {
      try {
        const message: InboundMessages = JSON.parse(data.toString());
        this.logger.info({ messageType: message.type }, "Received message");

        switch (message.type) {
          case "setup":
            if (handleSetup) {
              await handleSetup(message);
            }
            await this.init(message);
            break;

          case "prompt":
            await this.handlePrompt(message);
            break;

          case "interrupt":
            await this.handleInterrupt(message);
            break;

          case "dtmf":
            await this.handleDTMF(message);
            break;

          case "error":
            await this.handleError(message);
            break;

          default:
            this.logger.warn(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { type: (message as any).type },
              "Unknown message type",
            );
        }
      } catch (error) {
        this.logger.error(
          { error: (error as Error).message },
          "Error processing message",
        );
      }
    });
  }

  /**
   * Handles the connection closed
   */
  public async close() {
    await this.handleClose();
  }

  /**
   * Sends a token message to the client.
   * @param token   the token to send
   * @param last  whether this is the last token in the sequence
   * @param additional  additional properties to include in the message
   */
  public sendToken(
    token: string,
    last = false,
    additional?: Omit<TextMessage, "type" | "token" | "last">,
  ) {
    this.logger.info(`Sending token ${token}`);
    this.send({
      type: "text",
      token,
      last,
      ...additional,
    });
  }

  /**
   * Plays a media file to the client.
   * @param source  the source of the media file
   * @param additional  additional properties to include in the message
   */
  public play(
    source: string,
    additional?: Omit<PlayMessage, "type" | "source">,
  ) {
    this.send({
      type: "play",
      source,
      ...additional,
    });
  }

  /**
   * Sends a digit to the client.
   * @param digits  the digit to send
   */
  public sendDigits(digits: string) {
    this.send({
      type: "sendDigits",
      digits,
    });
  }

  /**
   * Changes the language of the client.
   * @param language  the language to change to
   */
  public language(language: Omit<LanguageMessage, "type">) {
    this.send({
      type: "language",
      ...language,
    });
  }

  /**
   * Ends the session.
   * @param handoffData  optional data to pass to the handoff
   */
  public end(handoffData?: string) {
    this.send({
      type: "end",
      handoffData,
    });
  }

  /**
   * Handles a setup message.
   * @param message  the setup message to handle
   */
  public async handleSetup(message: SetupMessage) {
    this.logger.debug(`Handling setup message: ${JSON.stringify(message)}`);
  }

  /**
   * Handles a prompt message.
   * @param message  the prompt message to handle
   */
  public async handlePrompt(message: PromptMessage) {
    this.logger.debug(`Handling prompt message: ${JSON.stringify(message)}`);
  }

  /**
   * Handles an interrupt message.
   * @param message  the interrupt message to handle
   */
  public async handleInterrupt(message: InterruptMessage) {
    this.logger.debug(`Handling interrupt message: ${JSON.stringify(message)}`);
  }

  /**
   * Handles a DTMF message.
   * @param message  the DTMF message to handle
   */
  public async handleDTMF(message: DTMFMessage) {
    this.logger.debug(`Handling DTMF message: ${JSON.stringify(message)}`);
  }

  /**
   * Handles an error message.
   * @param message  the error message to handle
   */
  public async handleError(message: ErrorMessage) {
    this.logger.error(`Handling error message: ${JSON.stringify(message)}`);
  }

  public async handleClose() {
    this.logger.debug("WebSocket connection closed");
  }

  /**
   * Sends an outbound message.
   * @param message  the outbound message to send
   */
  private send(message: OutboundMessage) {
    if (this.connection.readyState === WebSocket.OPEN) {
      this.connection.send(JSON.stringify(message));
    } else {
      this.logger.warn(`WebSocket is not open. Message not sent: ${message}1`);
    }
  }

  private async init(message: SetupMessage) {
    this.session = {
      ...this.session,
      ...message,
    };
    this.logger = this.logger.child({
      callSid: message.callSid,
      sessionId: message.sessionId,
    });
    await this.handleSetup(message);
  }
}

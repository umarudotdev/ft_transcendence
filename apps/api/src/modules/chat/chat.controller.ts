import { Elysia, t } from "elysia";

import { authGuard } from "../../common/guards/auth.macro";
import { logger } from "../../common/logger";
import { AuthService } from "../auth/auth.service";

const chatLogger = logger.child().withContext({ module: "chat" });
import { ChatModel, mapChatError, type WSClientMessage } from "./chat.model";
import { ChatService } from "./chat.service";

export const chatController = new Elysia({ prefix: "/chat" })
  .use(authGuard)
  // GET /chat/conversations - List user's conversations
  .get("/conversations", async ({ user }) => {
    const result = await ChatService.getConversations(user.id);

    return result.match(
      (conversations) => ({ conversations }),
      () => ({ conversations: [] })
    );
  })
  // POST /chat/conversations/dm - Create or get a DM with another user
  .post(
    "/conversations/dm",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ChatService.createOrGetDM(user.id, body.userId);

      return result.match(
        ({ channelId, isNew }) => ({
          channelId,
          isNew,
        }),
        (error) => {
          const problem = mapChatError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: ChatModel.createDMBody,
    }
  )
  // GET /chat/conversations/:channelId - Get channel info
  .get(
    "/conversations/:channelId",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ChatService.getChannelInfo(
        user.id,
        params.channelId
      );

      return result.match(
        (channel) => ({ channel }),
        (error) => {
          const problem = mapChatError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ChatModel.channelIdParam,
    }
  )
  // GET /chat/conversations/:channelId/messages - Get message history
  .get(
    "/conversations/:channelId/messages",
    async ({ params, query, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ChatService.getMessages(user.id, params.channelId, {
        limit: query.limit,
        before: query.before,
      });

      return result.match(
        (messages) => ({ messages }),
        (error) => {
          const problem = mapChatError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ChatModel.channelIdParam,
      query: ChatModel.messagesQuery,
    }
  )
  // POST /chat/conversations/:channelId/messages - Send a message (REST fallback)
  .post(
    "/conversations/:channelId/messages",
    async ({ params, body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ChatService.sendMessage(
        user.id,
        params.channelId,
        body.content
      );

      return result.match(
        (message) => ({ message }),
        (error) => {
          const problem = mapChatError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ChatModel.channelIdParam,
      body: ChatModel.sendMessageBody,
    }
  )
  // POST /chat/conversations/:channelId/read - Mark as read
  .post(
    "/conversations/:channelId/read",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ChatService.markAsRead(user.id, params.channelId);

      return result.match(
        ({ readAt }) => ({ readAt }),
        (error) => {
          const problem = mapChatError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ChatModel.channelIdParam,
    }
  )
  // WebSocket endpoint for real-time chat
  .ws("/ws", {
    query: t.Object({
      sessionId: t.String(),
    }),
    async open(ws) {
      const sessionId = ws.data.query.sessionId;

      // Validate session
      const result = await AuthService.validateSession(sessionId);

      if (result.isErr()) {
        chatLogger
          .withMetadata({ wsEvent: "open", action: "auth_failed" })
          .warn("WS auth failed: Invalid session");
        ws.send(JSON.stringify({ type: "error", error: "Invalid session" }));
        ws.close();
        return;
      }

      const user = result.value;

      // Store user ID on the websocket data for later use
      (ws.data as { userId?: number }).userId = user.id;

      // Register connection
      ChatService.registerConnection(user.id, ws.raw as unknown as WebSocket);

      chatLogger
        .withMetadata({ wsEvent: "open", action: "connected", userId: user.id })
        .info("WS connection opened");
    },
    async message(ws, message) {
      const userId = (ws.data as { userId?: number }).userId;

      if (!userId) {
        ws.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
        return;
      }

      try {
        const data = message as WSClientMessage;

        switch (data.type) {
          case "send_message": {
            const result = await ChatService.sendMessage(
              userId,
              data.channelId,
              data.content
            );

            result.match(
              (msg) => {
                ws.send(
                  JSON.stringify({
                    type: "message_sent",
                    data: {
                      id: msg.id,
                      channelId: msg.channelId,
                      content: msg.content,
                      sender: msg.sender,
                      createdAt: msg.createdAt.toISOString(),
                    },
                  })
                );
              },
              (error) => {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    error: `Failed to send message: ${error.type}`,
                  })
                );
              }
            );
            break;
          }

          case "typing_start": {
            await ChatService.startTyping(userId, data.channelId);
            break;
          }

          case "typing_stop": {
            await ChatService.stopTyping(userId, data.channelId);
            break;
          }

          case "mark_read": {
            await ChatService.markAsRead(userId, data.channelId);
            break;
          }
        }
      } catch {
        ws.send(
          JSON.stringify({ type: "error", error: "Invalid message format" })
        );
      }
    },
    close(ws) {
      const userId = (ws.data as { userId?: number }).userId;

      if (userId) {
        ChatService.unregisterConnection(
          userId,
          ws.raw as unknown as WebSocket
        );

        chatLogger
          .withMetadata({ wsEvent: "close", action: "disconnected", userId })
          .info("WS connection closed");
      }
    },
  });

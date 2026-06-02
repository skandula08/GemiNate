import { useEffect, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import type {
  ChatInfo,
  ChatMoveLogPayload,
  ChatNewMessagePayload,
  ChatUserJoinedPayload,
} from "@gamenite/shared";
import type { ChatMessage } from "../util/types.ts";
import useAuth from "./useAuth.ts";

/** Extract the timestamp from any ChatMessage variant */
function messageTime(msg: ChatMessage): number {
  const date = "createdAt" in msg ? msg.createdAt : msg.dateTime;
  // TypeScript claims `date` is type `Date`, but this isn't always accurate:
  // `createdAt` times that are sent via JSON are turned into strings. Here
  // we use a slightly hacky fix to ensure we'll get a correct date.
  if (typeof date === "string") return new Date(date).getTime();
  return date.getTime();
}

/**
 * Merge two chronologically-sorted ChatMessage arrays into one sorted array.
 */
function mergeByTime(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (messageTime(a[i]) <= messageTime(b[j])) {
      result.push(a[i++]);
    } else {
      result.push(b[j++]);
    }
  }
  while (i < a.length) result.push(a[i++]);
  while (j < b.length) result.push(b[j++]);
  return result;
}

/**
 * Custom hook to manage the socket connection for a chat.
 * @throws if outside a LoginContext
 * @returns an object containing
 * - `messages`: The current list of messages in the chat, including
 *   move log entries interleaved chronologically.
 * - `handleMessageCreation`: Sends a new message to the chat
 */

export default function useSocketsForChat(chatId: string) {
  const auth = useAuth();
  const { user, socket } = useLoginContext();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    const handleChatJoined = (chat: ChatInfo) => {
      if (chat.chatId !== chatId) return;
      socket.off("chatJoined", handleChatJoined);

      // Build the initial message list by merging stored messages and
      // persisted move log entries chronologically (both are already sorted)
      const chatMessages: ChatMessage[] = chat.messages;
      const moveLogMessages: ChatMessage[] = chat.moveLog.map((entry, index) => ({
        messageId: `movelog-init-${index}`,
        meta: "move" as const,
        moveDescription: entry.moveDescription,
        user: entry.user,
        dateTime: new Date(entry.createdAt),
      }));

      const allMessages = mergeByTime(chatMessages, moveLogMessages);

      setMessages([
        ...allMessages,
        { messageId: `meta${Math.random()}`, meta: "entered", user, dateTime: new Date() },
      ]);
      socket.on("chatNewMessage", handleNewMessage);
      socket.on("chatUserJoined", handleUserJoined);
      socket.on("chatMoveLog", handleMoveLog);
    };

    const handleNewMessage = (payload: ChatNewMessagePayload) => {
      if (payload.chatId === chatId) {
        setMessages((oldMessages) => {
          if (!oldMessages) return null;
          return [...oldMessages, payload.message];
        });
      }
    };

    const handleUserJoined = (payload: ChatUserJoinedPayload) => {
      if (payload.chatId === chatId)
        setMessages((oldMessages) => {
          if (!oldMessages) return null;
          return [
            ...oldMessages,
            {
              messageId: `meta${Math.random()}`,
              meta: "entered",
              user: payload.user,
              dateTime: new Date(),
            },
          ];
        });
    };

    const handleMoveLog = (payload: ChatMoveLogPayload) => {
      if (payload.chatId === chatId) {
        setMessages((oldMessages) => {
          if (!oldMessages) return null;
          return [
            ...oldMessages,
            {
              messageId: `movelog-${Date.now()}-${Math.random()}`,
              meta: "move",
              moveDescription: payload.moveDescription,
              user: payload.user,
              dateTime: new Date(payload.createdAt),
            },
          ];
        });
      }
    };

    socket.emit("chatJoin", { auth, payload: chatId });
    socket.on("chatJoined", handleChatJoined);
    return () => {
      socket.off("chatNewMessage", handleNewMessage);
      socket.off("chatUserJoined", handleUserJoined);
      socket.off("chatJoined", handleChatJoined);
      socket.off("chatMoveLog", handleMoveLog);
      socket.emit("chatLeave", { auth, payload: chatId });
    };
  }, [socket, auth, chatId, user]);

  function handleMessageCreation(text: string) {
    socket.emit("chatSendMessage", { auth, payload: { chatId, text } });
  }

  return { messages, handleMessageCreation };
}

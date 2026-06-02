import "./MessageList.css";
import useLoginContext from "../hooks/useLoginContext.ts";
import type { ChatMessage } from "../util/types.ts";
import { useEffect, useRef } from "react";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 *
 * @param messages a list of Chat messages
 * @returns all the chat messages rendered to show you're messages vs other people's messages.
 */
export default function MessageList({ messages }: MessageListProps) {
  const { user } = useLoginContext();
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const timeSince = useTimeSince();
  useEffect(() => {
    if (!chatWindowRef.current) return;
    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chatWindow" ref={chatWindowRef}>
      <div className="chatScroller">
        {messages.map((message) => {
          if ("meta" in message) {
            if (message.meta === "move") {
              return (
                <div
                  key={message.messageId}
                  className="chatMoveLog"
                  style={
                    // message.moveDescription === " progressed to the next round..." ||
                    message.moveDescription === " ended the game!"
                      ? { backgroundColor: "#ffedf2", borderColor: "#ffc9d7" }
                      : {}
                  }
                >
                  <UserLink user={message.user} />
                  {message.moveDescription}
                </div>
              );
            }
            return (
              <div key={message.messageId} className="chatMeta">
                <UserLink user={message.user} /> {message.meta}
                {" chat "}
                {timeSince(message.dateTime)}
              </div>
            );
          }
          if (user.username === message.createdBy.username) {
            return (
              <div key={message.messageId} className="chatMe">
                <div className="chatSender">{timeSince(message.createdAt)}</div>
                <div className="chatContent">{message.text}</div>
              </div>
            );
          }
          return (
            <div key={message.messageId} className="chatOther">
              <div className="chatSender">
                <UserLink user={message.createdBy} /> {timeSince(message.createdAt)}
              </div>
              <div className="chatContent">{message.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

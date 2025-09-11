import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import { startConversation, sendMessage, endConversation, sendToGemini } from "./geminiChat";
// add d
import { highlightResponseWithSources } from "./referenceHighlighter";


function LandingPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLarge, setIsLarge] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [showChatPage, setShowChatPage] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const chatScrollRef = useRef(null);
  

  const toggleChat = () => setIsOpen(!isOpen);

  const handleStartChat = async () => {
    if (name.trim() && location.trim()) {
      // Start a new conversation when chat begins
      try {
        const convId = await startConversation();
        setConversationId(convId);
        setShowChatPage(true);
      } catch (error) {
        console.error("Error starting conversation:", error);
        // Still show chat page even if conversation start fails
        setShowChatPage(true);
      }
    }
  };

  const typeResponse = (response, callback) => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < response.length) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.type === "bot" && lastMsg.isTyping) {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                text: response.substring(0, i + 1),
                isTyping: true
              }
            ];
          }
          return [
            ...prev,
            {
              type: "bot",
              text: response.substring(0, i + 1),
              isTyping: true
            }
          ];
        });
        i++;
      } else {
        clearInterval(typingInterval);
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, isTyping: false }
          ];
        });
        callback();
      }
    },30);
  };

  // Inside handleSendMessage
const handleSendMessage = async () => {
  if (message.trim() && !isTyping) {
    const userText = message.trim();
    setMessages(prev => [...prev, { type: "user", text: userText }]);
    setMessage("");
    setIsTyping(true);

    // temporary "thinking" dot
    setMessages(prev => [
      ...prev,
      { type: "bot", text: "", isThinking: true }
    ]);

    try {
      // Use the conversation API to maintain memory
      const response = conversationId 
        ? await sendMessage(conversationId, userText)
        : "Please start a conversation first."; // Require conversation

      // Handle different response formats
      console.log("Raw response:", response); // DEBUG
      let botText, staticRef;
      if (typeof response === 'string') {
        // Simple string response from conversation API
        botText = response;
        staticRef = null;
      } else if (response && response.text) {
        // Structured response with references
        botText = response.text;
        staticRef = response.staticRef;
      } else {
        botText = "Something went wrong.";
        staticRef = null;
      }
      

      // transition thinking bubble into typing bubble
      setMessages(prev =>
        prev.map(msg =>
          msg.isThinking
            ? { ...msg, isThinking: false, isTyping: true, text: "" }
            : msg
        )
      );

      // Type out plain text first, then process HTML with references
      typeResponse(botText, () => {
        if (staticRef) {
          // Process response with reference highlighting
          const html = highlightResponseWithSources(botText, staticRef)
          
          // Replace the last bot message with HTML-rendered version
          setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            updated[lastIndex] = {
              ...updated[lastIndex],
              text: botText,
              html,
              isHtml: true,
              isTyping: false
            };
            return updated;
          });
        } else {
          console.log("No staticRef found, skipping highlighting"); // DEBUG
        }
        setIsTyping(false);
      });
    } catch {
      setMessages(prev =>
        prev.map(msg =>
          msg.isThinking
            ? { ...msg, isThinking: false, isTyping: true, text: "Something went wrong." }
            : msg
        )
      );
      setIsTyping(false);
    }
  }
};


  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClose = () => {
    // End the conversation when closing chat
    if (conversationId) {
      endConversation(conversationId);
      setConversationId(null);
    }
    setIsOpen(false);
    setShowChatPage(false);
    setIsLarge(false);
    setMessages([]); // Clear messages when closing
  };

  // Chat page
  if (showChatPage) {
    return (
      <div className={`chatbox ${isLarge ? "chatbox-large" : ""}`}>
        <div>
          <div className="chatbox-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="chatbox-icon-circle">
                <img
                  src="/src/assets/capstoneicon1.png"
                  alt="Icon"
                  className="chatbox-icon-img"
                />
              </div>
              <div className="chatbox-title-container">
                <p className="chatbox-title">Terah</p>
                <p className="chatbox-subtitle">The Epic Retirement AI Helper</p>
                <div className="chatbox-separator"></div>
              </div>
            </div>
            <div>
              <button
                style={{
                  marginRight: "5px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  padding: "4px 8px"
                }}
                onClick={() => setIsLarge(prev => !prev)}
              >
                ⛶
              </button>
              <button
                style={{
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  padding: "4px 8px"
                }}
                onClick={handleClose}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="chatbox-scroll-container" ref={chatScrollRef}>
          <div className="chatbox-disclaimer-container">
            <p className="chatbox-disclaimer-title">Disclaimer</p>
            <p className="chatbox-disclaimer-text">
              This is general information based on publicly available government
              sources such as the ATO and MoneySmart. It is not personal
              financial advice. For advice tailored to your situation, please
              speak with a licensed financial adviser.
            </p>
          </div>

          <div className="chatbox-message-bubble">
            <p style={{ margin: 0, fontWeight: "bold" }}>
              Hi {name}, I'm Terah the retirement bot!
            </p>
            <p style={{ margin: 0 }}>How can I help you today?</p>
          </div>

          {messages.map((msg, idx) => (
            <div key={idx}>
              {msg.type === "user" ? (
                <div className="chatbox-user-bubble">
                  <p style={{ margin: 0 }}>{msg.text}</p>
                </div>
              ) : msg.isThinking ? (
                <div className="typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              ) : (
                <div className="chatbox-message-bubble">
                  {msg.isHtml ? (
                    <div style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: msg.html }} />
                  ) : (
                    <p style={{ margin: 0 }}>{msg.text}</p>
                  )}
                </div>
              )}
            </div>
          ))}

        </div>

        <div className="chatbox-input-container">
          <input
            type="text"
            placeholder="Ask anything here!"
            className="chatbox-chat-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button className="chatbox-send-button" onClick={handleSendMessage}>
            →
          </button>
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <>
      {!isOpen && (
        <img
          src="/src/assets/capstoneicon1.png"
          alt="Capstone Icon"
          className="chatbox-launch-icon"
          onClick={toggleChat}
        />
      )}

      {isOpen && (
        <div className={`chatbox ${isLarge ? "chatbox-large" : ""}`}>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px" }}>
            <div className="chatbox-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="chatbox-icon-circle">
                  <img
                    src="/src/assets/capstoneicon1.png"
                    alt="Icon"
                    className="chatbox-icon-img"
                  />
                </div>
                <div className="chatbox-title-container">
                  <p className="chatbox-title">Terah</p>
                  <p className="chatbox-subtitle">
                    The Epic Retirement AI Helper
                  </p>
                  <div className="chatbox-separator"></div>
                </div>
              </div>
              <div>
                <button
                  style={{
                    marginRight: "5px",
                    background: "#f0f0f0",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    padding: "4px 8px"
                  }}
                  onClick={() => setIsLarge(prev => !prev)}
                >
                  ⛶
                </button>
                <button
                  style={{
                    background: "#f0f0f0",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    padding: "4px 8px"
                  }}
                  onClick={handleClose}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="chatbox-message-bubble">
              <p style={{ margin: 0, fontWeight: "bold" }}>Hello there!</p>
              <p style={{ margin: 0 }}>
                I am the Epic Retirement AI Helper and you can ask me about
                whatever retirement question you may have!
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label>
                Name
                <input
                  type="text"
                  placeholder="Enter your name"
                  className="chatbox-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Location
                <input
                  type="text"
                  placeholder="e.g. Australia or NZ"
                  className="chatbox-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <button className="chatbox-button" onClick={handleStartChat}>
                Start Chat →
              </button>
              <p className="chatbox-policy">
                We save no data - read our{" "}
                <a href="#" className="chatbox-link">
                  policy here
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const container = document.createElement("div");
document.body.appendChild(container);
const root = ReactDOM.createRoot(container);
root.render(<LandingPage />);

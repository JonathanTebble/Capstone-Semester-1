// Landingpage.jsx
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import { sendToGemini } from "./geminiChat1";

// add d
import { highlightResponseWithSources } from "./referenceHighlighter";


import { sendToGeminiHtml } from "./geminiChat";
// import { sendToGemini } from "./geminiChat"; // old

function LandingPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLarge, setIsLarge] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [showChatPage, setShowChatPage] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleStartChat = () => {
    if (name.trim() && location.trim()) {
      setShowChatPage(true);
    }
  };

  const typeResponse = (response, callback) => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < response.length) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          // If the last message is a bot message and it's still typing, update it
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
          // Otherwise, add a new bot message (for the first character or if previous was not typing bot)
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
          // Set isTyping to false for the last bot message
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              isTyping: false
            }
          ];
        });
        callback(); // Callback to set isTyping to false for the whole component
      }
    }, 30); // Adjust typing speed here (lower = faster)
  };

  //old
  // const handleSendMessage = async () => {
  //   if (message.trim() && !isTyping) {
  //     const userText = message.trim();
  //     setMessages(prev => [...prev, { type: "user", text: userText }]);
  //     setMessage("");
  //     setIsTyping(true);

  //     try {
  //       const response = await sendToGemini(userText);
  //       typeResponse(response, () => setIsTyping(false));
  //     } catch {
  //       typeResponse("Something went wrong.", () => setIsTyping(false));
  //     }
  //   }
  // };

  //new
  const handleSendMessage = async () => {
  if (message.trim() && !isTyping) {
    const userText = message.trim();
    setMessages(prev => [...prev, { type: "user", text: userText }]);
    setMessage("");
    setIsTyping(true);

    try {
      const { text: botText, staticRef } = await sendToGemini(userText);

      // 1) type out plain text (for the typing animation)
      typeResponse(botText, () => {
        // 2) when typing ends, post-process to HTML with references
        const html = highlightResponseWithSources(botText, staticRef);

        // replace the last bot message with an HTML-rendered one
        setMessages(prev => {
          const last = prev[prev.length - 1];
          // last is the bot message with isTyping false now
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: botText,    // keep text for fallback
            html,             // new field
            isHtml: true,     // flag to render as HTML
            isTyping: false,
          };
          return updated;
        });

        setIsTyping(false);
      });
    } catch {
      typeResponse("Something went wrong.", () => setIsTyping(false));
    }
  }
};



  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClose = () => {
    setIsOpen(false);
    setShowChatPage(false);
    setIsLarge(false);
  };

  if (showChatPage) {
    return (
      <div className={`chatbox ${isLarge ? "chatbox-large" : ""}`}>
        <div>
          <div className="chatbox-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="chatbox-icon-circle">
                <img src="/src/assets/capstoneicon1.png" alt="Icon" className="chatbox-icon-img" />
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
                  padding: "4px 8px",
                }}
                onClick={() => setIsLarge((prev) => !prev)}
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
                  padding: "4px 8px",
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
            <p style={{ margin: 0, fontWeight: "bold" }}>Hi {name}, I'm Terah the retirement bot!</p>
            <p style={{ margin: 0 }}>How can I help you today?</p>
          </div>
          
          {/* Old */}
          {/* {messages.map((msg, idx) => (
            <div
              key={idx}
              className={
                msg.type === "user"
                  ? "chatbox-user-bubble"
                  : "chatbox-message-bubble"
              }
            >
              <p style={{ margin: 0 }}>{msg.text}</p>
              {msg.isTyping && (
                <span className="typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </span>
              )}
            </div>
          ))} */}


          {/* New */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={
                msg.type === "user"
                  ? "chatbox-user-bubble"
                  : "chatbox-message-bubble"
              }
            >
              {/* If html exists, render it safely; else render plain text */}
              {msg.isHtml ? (
                <div
                  className="terah-content"
                  dangerouslySetInnerHTML={{ __html: msg.html }}
                />
              ) : (
                <p style={{ margin: 0 }}>{msg.text}</p>
              )}


              {msg.isTyping && (
                <span className="typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </span>
              )}
            </div>
          ))}

        </div> {/* End of chatbox-scroll-container */}

        <div className="chatbox-input-container">
          <input
            id="chat-input"
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

  // Landing state with launcher icon and name/location form
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
                  <img src="/src/assets/capstoneicon1.png" alt="Icon" className="chatbox-icon-img" />
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
                    padding: "4px 8px",
                  }}
                  onClick={() => setIsLarge((prev) => !prev)}
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
                    padding: "4px 8px",
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
                I am the Epic Retirement AI Helper and you can ask me about whatever retirement
                question you may have!
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="name-input">Name</label>
              <input
                id="name-input"
                type="text"
                placeholder="Enter your name"
                className="chatbox-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label htmlFor="location-input">Location</label>
              <input
                id="location-input"
                type="text"
                placeholder="e.g. Australia or NZ"
                className="chatbox-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

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

export default LandingPage;

/**
 * Safe self-mount: run once after DOM ready
 */
(function mountOnce() {
  if (typeof window === "undefined") return;
  const MOUNT_ID = "terah-standalone-root";
  function doMount() {
    let container = document.getElementById(MOUNT_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = MOUNT_ID;
      document.body.appendChild(container);
    }
    if (!container.__root) {
      container.__root = ReactDOM.createRoot(container);
      container.__root.render(<LandingPage />);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doMount, { once: true });
  } else {
    doMount();
  }
  if (import.meta && import.meta.hot) {
    import.meta.hot.dispose(() => {
      const el = document.getElementById(MOUNT_ID);
      if (el && el.__root) {
        el.__root.unmount();
        el.__root = null;
      }
    });
  }
})();

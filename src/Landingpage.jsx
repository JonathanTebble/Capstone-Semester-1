// Landingpage.jsx
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
<<<<<<< HEAD
import { sendToGeminiHtml } from "./geminiChat1";
=======
import { sendToGemini } from "./geminiChat";


>>>>>>> origin/static

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

  function stripHtmlToText(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || div.innerText || "").trim();
  }

  const handleSendMessage = async () => {
    if (message.trim() && !isTyping) {
      const userText = message.trim();
      setMessages((prev) => [...prev, { type: "user", text: userText }]);
      setMessage("");
      setIsTyping(true);

      try {
        const placeholderIndex = (() => {
          let idx = -1;
          setMessages((prev) => {
            const copy = [...prev, { type: "bot", text: "", isTyping: true }];
            idx = copy.length - 1;
            return copy;
          });
          return () => idx;
        })();

        const htmlReply = (await sendToGeminiHtml(userText)) || "";
        const plainForTyping = stripHtmlToText(htmlReply);

        let i = 0;
        const typeInterval = setInterval(() => {
          i++;
          setMessages((prev) => {
            const copy = [...prev];
            const idx = placeholderIndex();
            if (!copy[idx]) return prev;
            copy[idx] = { ...copy[idx], text: plainForTyping.slice(0, i), isTyping: true };
            return copy;
          });
          if (i >= plainForTyping.length) {
            clearInterval(typeInterval);
            setMessages((prev) => {
              const copy = [...prev];
              const idx = placeholderIndex();
              if (!copy[idx]) return prev;
              copy[idx] = { type: "bot", html: htmlReply, isTyping: false };
              return copy;
            });
            setIsTyping(false);
          }
        }, 20);
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          { type: "bot", text: "Something went wrong.", isTyping: false },
        ]);
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

          {messages.map((msg, idx) => {
            if (msg.type === "user") {
              return (
                <div key={idx} className="chatbox-user-bubble">
                  <p style={{ margin: 0 }}>{msg.text}</p>
                </div>
              );
            }

            if (msg.isTyping && (!msg.text || msg.text.length === 0)) {
              return (
                <div key={idx} className="chatbox-typing-row">
                  <span className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </span>
                </div>
              );
            }

            if (msg.isTyping) {
              return (
                <div key={idx} className="chatbox-message-bubble">
                  <p style={{ margin: 0 }}>{msg.text}</p>
                  <span className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </span>
                </div>
              );
            }

            return (
              <div key={idx} className="chatbox-message-bubble">
                {msg.html ? (
                  <div
                    style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: msg.html }}
                  />
                ) : (
                  <p style={{ margin: 0 }}>{msg.text}</p>
                )}
              </div>
            );
          })}
        </div>

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

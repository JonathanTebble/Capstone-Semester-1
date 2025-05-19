import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";

function LandingPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [showChatPage, setShowChatPage] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const chatScrollRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);;

  const handleStartChat = () => {
    if (name.trim() && location.trim()) {
      setShowChatPage(true);
    }
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      setMessages((prev) => [...prev, { type: "user", text: message }]);
      setMessage("");
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (showChatPage) {
    return (
      <div className="chatbox">
        <div
          className="chatbox-scroll-container"
          ref={chatScrollRef}
        >
          <div className="chatbox-header">
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
            <div
              key={idx}
              className={
                msg.type === "user"
                  ? "chatbox-user-bubble"
                  : "chatbox-message-bubble"
              }
            >
              <p style={{ margin: 0 }}>{msg.text}</p>
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
        <div className="chatbox">
          <div style={{ flex: 1, overflowY: "auto", marginBottom: "10px" }}>
            <div className="chatbox-header">
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

// Mount the component into a new DOM node
const container = document.createElement("div");
document.body.appendChild(container);

const root = ReactDOM.createRoot(container);
root.render(<LandingPage />);

import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:8080'; // Use your backend port

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [readStatus, setReadStatus] = useState({});
  const socket = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:8080/api/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch users');
        setUsers(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    socket.current = io(SOCKET_URL);
    socket.current.emit('add-user', user.id);
    socket.current.on('online-users', (online) => {
      setOnlineUsers(online);
    });
    socket.current.on('msg-receive', (data) => {
      setMessages((prev) => [...prev, { from: data.from, message: data.message, read: false }]);
    });
    socket.current.on('msg-read', (data) => {
      setReadStatus((prev) => ({ ...prev, [data.from]: true }));
    });
    return () => {
      socket.current.disconnect();
    };
  }, [user.id]);

  // Fetch chat history when a user is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedUser) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `http://localhost:8080/api/messages?from=${user.id}&to=${selectedUser._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch messages');
        setMessages(data.map((msg) => ({ from: msg.from, message: msg.message, read: msg.read })));
        // Mark messages as read
        await fetch('http://localhost:8080/api/messages/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ from: selectedUser._id, to: user.id }),
        });
        socket.current.emit('message-read', { from: selectedUser._id, to: user.id });
        setReadStatus((prev) => ({ ...prev, [selectedUser._id]: true }));
      } catch (err) {
        setError(err.message);
      }
    };
    fetchMessages();
  }, [selectedUser, user.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;
    // Send to backend for persistence
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:8080/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ from: user.id, to: selectedUser._id, message }),
      });
    } catch {
      setError('Failed to send message');
    }
    // Send via socket for real-time
    setMessages((prev) => [...prev, { from: user.id, message, read: false }]);
    setReadStatus((prev) => ({ ...prev, [selectedUser._id]: false }));
    socket.current.emit('send-msg', {
      to: selectedUser._id,
      from: user.id,
      message,
    });
    setMessage('');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left panel: User list */}
      <div style={{ width: '20%', borderRight: '1px solid #ccc', padding: 16 }}>
        <h3>Users</h3>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map((userItem) => (
            <li
              key={userItem._id}
              style={{
                padding: 8,
                cursor: 'pointer',
                background: selectedUser && selectedUser._id === userItem._id ? '#eee' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => {
                setSelectedUser(userItem);
              }}
            >
              <span>
                {userItem.username}
                {onlineUsers.includes(userItem._id) && (
                  <span style={{ color: 'green', marginLeft: 8, fontSize: 12 }}>●</span>
                )}
              </span>
              {readStatus[userItem._id] === false && selectedUser && selectedUser._id === userItem._id && (
                <span style={{ color: 'red', fontSize: 12, marginLeft: 8 }}>● Unread</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {/* Right panel: Chat area */}
      <div style={{ width: '80%', padding: 16, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {selectedUser ? (
          <>
            <h3>Chat with {selectedUser.username}</h3>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ccc', marginBottom: 8, padding: 8 }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ textAlign: msg.from === user.id ? 'right' : 'left' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: msg.from === user.id ? '#aee1f9' : '#eee',
                      padding: '6px 12px',
                      borderRadius: 12,
                      margin: '4px 0',
                    }}
                  >
                    {msg.message}
                  </span>
                  {msg.from === user.id && (
                    <span style={{ fontSize: 10, marginLeft: 6 }}>
                      {readStatus[selectedUser._id] ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} style={{ display: 'flex' }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 8 }}
              />
              <button type="submit" style={{ padding: '8px 16px' }}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div>Select a user to start chatting</div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

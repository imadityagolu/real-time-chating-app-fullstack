import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';
import { CiSearch } from "react-icons/ci";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { CiCamera } from "react-icons/ci";
import { GrGallery } from "react-icons/gr";
import { MdOutlineAudiotrack } from "react-icons/md";
import { VscLocation } from "react-icons/vsc";
import { RiUserFollowLine } from "react-icons/ri";
import { GrEmoji } from "react-icons/gr";
import { CiFolderOn } from "react-icons/ci";
import { IoVolumeMuteOutline } from "react-icons/io5";
import { GoClock } from "react-icons/go";
import { TbClearAll } from "react-icons/tb";
import { RiDeleteBinLine } from "react-icons/ri";
import { MdBlockFlipped } from "react-icons/md";
import EmojiPicker from 'emoji-picker-react';

const SOCKET_URL = 'http://localhost:8080'; // Use your backend port

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState({}); // Store messages per user
  const [message, setMessage] = useState('');
  const [readStatus, setReadStatus] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread counts per user
  const [searchQuery, setSearchQuery] = useState(''); // Search query for filtering friends
  const socket = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  
  const backendurl = import.meta.env.BACKEND_URL || 'http://localhost:8080';

  const [clickDropdown, setClickDropdown] = useState();
  const [clickDropdowntwo, setClickDropdownTwo] = useState();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const onEmojiClick = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
    setClickDropdownTwo(false); // Close file options when opening emoji picker
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (10MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only images (JPEG, PNG, GIF, WebP), videos (MP4, AVI, MOV, WMV), and PDF files are allowed');
      return;
    }

    setSelectedFile(file);
    setShowEmojiPicker(false); // Close emoji picker when file is selected
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedUser) return;

    console.log('Starting file upload...', {
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      backendUrl: backendurl,
      selectedUser: selectedUser._id
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('from', user.id);
      formData.append('to', selectedUser._id);

      const token = localStorage.getItem('token');
      const uploadUrl = `${backendurl}/api/upload-file`;
      console.log('Uploading to:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', errorText);
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      console.log('Upload successful, response:', data);
      
      // Add the file message to the conversation
      const fileMessage = {
        from: user.id,
        message: `📎 ${selectedFile.name}`,
        fileUrl: data.fileUrl,
        fileType: selectedFile.type,
        fileName: selectedFile.name,
        timestamp: new Date(),
        read: false
      };

      console.log('Adding file message to chat:', fileMessage);

      setMessages(prev => {
        const newMessages = {
          ...prev,
          [selectedUser._id]: [...(prev[selectedUser._id] || []), fileMessage]
        };
        console.log('Updated messages:', newMessages);
        return newMessages;
      });

      // Emit socket event for real-time delivery
      socket.current.emit('send-msg', {
        from: user.id,
        to: selectedUser._id,
        message: fileMessage.message,
        fileUrl: fileMessage.fileUrl,
        fileType: fileMessage.fileType,
        fileName: fileMessage.fileName
      });

      setSelectedFile(null);
      setUploadProgress(0);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const calculateUnreadCount = (userId) => {
    const userMessages = messages[userId] || [];
    return userMessages.filter(msg => msg.from === userId && !msg.read).length;
  };

  const scrollToFirstUnreadMessage = () => {
    if (!messageContainerRef.current || !selectedUser) return;
    
    const userMessages = messages[selectedUser._id] || [];
    const firstUnreadIndex = userMessages.findIndex(msg => msg.from === selectedUser._id && !msg.read);
    
    if (firstUnreadIndex !== -1) {
      const messageElements = messageContainerRef.current.children;
      if (messageElements[firstUnreadIndex]) {
        messageElements[firstUnreadIndex].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    } else {
      // If no unread messages, scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getLastMessage = (userId) => {
    const userMessages = messages[userId] || [];
    if (userMessages.length === 0) return 'No conversation';
    
    const lastMessage = userMessages[userMessages.length - 1];
    const isFromCurrentUser = lastMessage.from === user.id;
    const prefix = isFromCurrentUser ? 'You: ' : '';
    const messageText = lastMessage.message.length > 20 
      ? lastMessage.message.substring(0, 20) + '...' 
      : lastMessage.message;
    
    return prefix + messageText;
  };

  const getLastMessageTime = (userId) => {
    const userMessages = messages[userId] || [];
    if (userMessages.length === 0) return '';
    
    const lastMessage = userMessages[userMessages.length - 1];
    return lastMessage.timestamp ? formatTime(lastMessage.timestamp) : '';
  };

  const getLastMessageTimestamp = (userId) => {
    const userMessages = messages[userId] || [];
    if (userMessages.length === 0) return new Date(0); // Very old date for sorting
    
    const lastMessage = userMessages[userMessages.length - 1];
    return lastMessage.timestamp ? new Date(lastMessage.timestamp) : new Date(0);
  };

  const getLastMessageStatus = (userId) => {
    const userMessages = messages[userId] || [];
    if (userMessages.length === 0) return null;
    
    const lastMessage = userMessages[userMessages.length - 1];
    // Only show status for messages sent by current user
    if (lastMessage.from === user.id) {
      return lastMessage.read ? '✓✓' : '✓';
    }
    return null;
  };

  const getFilteredUsers = () => {
    if (!searchQuery.trim()) return users;
    
    return users.filter(userItem => 
      userItem.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Close emoji picker and dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker && !event.target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
      if (clickDropdowntwo && !event.target.closest('.file-dropdown-container')) {
        setClickDropdownTwo(false);
      }
      if (clickDropdown && !event.target.closest('.settings-dropdown-container')) {
        setClickDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, clickDropdowntwo, clickDropdown]);

  useEffect(() => {
    // Test backend connection
    console.log('Backend URL:', backendurl);
    
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${backendurl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch users');
        setUsers(data);
        
        // Fetch conversations for the current user
        const conversationsRes = await fetch(`${backendurl}/api/conversations/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const conversationsData = await conversationsRes.json();
        
        if (conversationsRes.ok) {
          const allMessages = {};
          conversationsData.forEach(conversation => {
            // Find the other participant (not the current user)
            const otherParticipant = conversation.participants.find(p => p._id !== user.id);
            if (otherParticipant) {
              allMessages[otherParticipant._id] = conversation.messages.map((msg) => ({ 
                from: msg.from, 
                message: msg.message, 
                read: msg.read,
                timestamp: msg.timestamp,
                fileUrl: msg.fileUrl,
                fileType: msg.fileType,
                fileName: msg.fileName
              }));
            }
          });
          setMessages(allMessages);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUsers();
  }, [user.id]);

  useEffect(() => {
    socket.current = io(SOCKET_URL);
    socket.current.emit('add-user', user.id);
    socket.current.on('online-users', (online) => {
      setOnlineUsers(online);
    });
    socket.current.on('msg-receive', (data) => {
      setMessages((prev) => {
        const userId = data.from === user.id ? data.to : data.from;
        const userMessages = prev[userId] || [];
        return {
          ...prev,
          [userId]: [...userMessages, { 
            from: data.from, 
            message: data.message, 
            fileUrl: data.fileUrl,
            fileType: data.fileType,
            fileName: data.fileName,
            read: false,
            timestamp: new Date()
          }]
        };
      });
      
      // Increment unread count for received messages
      if (data.from !== user.id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.from]: (prev[data.from] || 0) + 1
        }));
      }
    });
    socket.current.on('msg-read', (data) => {
      setReadStatus((prev) => ({ ...prev, [data.from]: true }));

      // Update message read status for messages sent by this user to the user who just read them
      setMessages((prev) => {
        const updatedMessages = { ...prev };
        if (updatedMessages[data.from]) {
          updatedMessages[data.from] = updatedMessages[data.from].map(msg =>
            msg.from === user.id ? { ...msg, read: true } : msg
          );
        }
        return updatedMessages;
      });
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
          `${backendurl}/api/messages?from=${user.id}&to=${selectedUser._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch messages');
        
        console.log('Fetched messages for selected user:', data);
        console.log('Message count:', data.length);
        console.log('User messages:', data.filter(msg => msg.from === user.id).length);
        console.log('Sample message structure:', data[0]);
        
        setMessages((prev) => ({
          ...prev,
          [selectedUser._id]: data.map((msg) => ({ 
            from: msg.from, 
            message: msg.message, 
            read: msg.read,
            timestamp: msg.timestamp,
            fileUrl: msg.fileUrl,
            fileType: msg.fileType,
            fileName: msg.fileName
          }))
        }));
        // Mark messages as read
        await fetch(`${backendurl}/api/messages/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ from: selectedUser._id, to: user.id }),
        });
        socket.current.emit('message-read', { from: selectedUser._id, to: user.id });
        setReadStatus((prev) => ({ ...prev, [selectedUser._id]: true }));
        
        // Update messages to mark them as read
        setMessages((prev) => ({
          ...prev,
          [selectedUser._id]: (prev[selectedUser._id] || []).map(msg => ({
            ...msg,
            read: msg.from === selectedUser._id ? true : msg.read
          }))
        }));
        
        // Update unread counts after marking messages as read
        setUnreadCounts((prev) => ({
          ...prev,
          [selectedUser._id]: 0
        }));
        
        // Force recalculation of unread counts after a delay
        setTimeout(() => {
          const newUnreadCounts = {};
          Object.keys(messages).forEach(userId => {
            const count = calculateUnreadCount(userId);
            newUnreadCounts[userId] = count;
            console.log(`User ${userId}: ${count} unread messages`);
          });
          setUnreadCounts(newUnreadCounts);
        }, 200);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchMessages();
  }, [selectedUser, user.id]);

  // Calculate unread counts whenever messages change
  useEffect(() => {
    const newUnreadCounts = {};
    Object.keys(messages).forEach(userId => {
      newUnreadCounts[userId] = calculateUnreadCount(userId);
    });
    setUnreadCounts(newUnreadCounts);
  }, [messages, selectedUser]);

  // Scroll to first unread message when messages are loaded
  useEffect(() => {
    if (selectedUser && messages[selectedUser._id]) {
      setTimeout(() => {
        scrollToFirstUnreadMessage();
      }, 100); // Small delay to ensure DOM is updated
    }
  }, [messages, selectedUser]);

  const handleMessageSelection = (messageIndex) => {
    if (!isSelectionMode) return;
    
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedMessages.size} selected message(s)?`)) {
      try {
        const token = localStorage.getItem('token');
        const userMessages = messages[selectedUser._id] || [];
        const selectedMessageData = Array.from(selectedMessages)
          .map(index => userMessages[index])
          .filter(msg => msg.from === user.id) // Only allow deletion of user's own messages
          .map(msg => ({
            timestamp: msg.timestamp,
            message: msg.message,
            from: msg.from
          }));
        
        console.log('Selected messages to delete:', selectedMessageData);
        
        const requestBody = { 
          messages: selectedMessageData,
          from: user.id, 
          to: selectedUser._id 
        };
        console.log('Request body:', requestBody);
        
        const response = await fetch(`${backendurl}/api/messages/delete-selected`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        const responseData = await response.json();
        console.log('Backend response:', responseData);
        
        if (!response.ok) {
          throw new Error(responseData.message || 'Failed to delete messages');
        }
        
                // Refresh messages from server to ensure consistency
        const refreshRes = await fetch(
          `${backendurl}/api/messages?from=${user.id}&to=${selectedUser._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const refreshData = await refreshRes.json();
        console.log('Refreshed messages from server:', refreshData);
        console.log('Refreshed message count:', refreshData.length);
        
        if (refreshRes.ok) {
          setMessages(prev => ({
            ...prev,
            [selectedUser._id]: refreshData.map((msg) => ({ 
              from: msg.from, 
              message: msg.message, 
              read: msg.read,
              timestamp: msg.timestamp,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              fileName: msg.fileName
            }))
          }));
        } else {
          // Fallback: manually remove selected messages from local state
          console.log('Server refresh failed, using local state fallback');
          setMessages(prev => ({
            ...prev,
            [selectedUser._id]: (prev[selectedUser._id] || []).filter((msg, index) => 
              !selectedMessages.has(index)
            )
          }));
        }
        
        // Exit selection mode
        setIsSelectionMode(false);
        setSelectedMessages(new Set());
      } catch (error) {
        console.error('Error deleting selected messages:', error);
        alert('Failed to delete messages. Please try again.');
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;
    // Send to backend for persistence
    try {
      const token = localStorage.getItem('token');
      await fetch(`${backendurl}/api/messages`, {
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
    setMessages((prev) => {
      const userMessages = prev[selectedUser._id] || [];
      return {
        ...prev,
        [selectedUser._id]: [...userMessages, { 
          from: user.id, 
          message, 
          read: false,
          timestamp: new Date()
        }]
      };
    });
    setReadStatus((prev) => ({ ...prev, [selectedUser._id]: false }));
    socket.current.emit('send-msg', {
      to: selectedUser._id,
      from: user.id,
      message,
    });
    setMessage('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', backgroundColor:'rgb(223, 221, 221)', padding:'15px' }}>

      
      <span style={{fontWeight:'bold', fontSize:'25px'}}>Chat</span>
      <span style={{color:'rgb(73, 73, 73)', marginBottom:'20px'}}>Manage your chats</span>

      {/* Header 
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 24px', 
        backgroundColor: '#f8f9fa', 
        borderBottom: '1px solid #dee2e6',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {user?.profilePicture ? (
            <img 
              src={user.profilePicture} 
              alt={user?.username}
              style={{ 
                width: '50px', 
                height: '50px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                border: '2px solid #ddd'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            style={{ 
              width: '50px', 
              height: '50px', 
              borderRadius: '50%', 
              backgroundColor: '#007bff',
              color: 'white',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              border: '2px solid #ddd',
              display: user?.profilePicture ? 'none' : 'flex'
            }}
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <h2 style={{ margin: 0, color: '#495057' }}>Welcome, {user?.username || 'User'}!</h2>
        </div>
        <button 
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
        >
          Logout
        </button>
      </div>
      */}
      
      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, height:'70vh', gap:'15px'  }}>
      
      {/* Left panel: User list */}
        <div style={{ width: '25%', 
          borderRight: '1px solid #ccc', 
          padding: '15px',
          height: 'calc(100vh - 150px)',
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor:'white', 
          borderRadius:'10px' }}>

          <div style={{ flexShrink: 0 }}>

            <span style={{fontWeight:'bold', fontSize:'20px'}}>Chats</span>
            
            {/* Search Box */}
            <div style={{ marginBottom: '15px', padding:'0px 10px'}} className="chat-list-search-box" >
              <input
                type="text"
                placeholder="Search For Contacts or Messages"
                className="chat-list-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                }}
              />
              <CiSearch />
            </div>
            
            {error && <div style={{ color: 'red' }}>{error}</div>}

          </div>
          
          <ul style={{ listStyle: 'none', padding: 0, overflowY: 'auto', flex: 1, marginTop:'-5px' }} className="chat-list-usersection">
          {getFilteredUsers()
            .sort((a, b) => {
              const aTimestamp = getLastMessageTimestamp(a._id);
              const bTimestamp = getLastMessageTimestamp(b._id);
              return bTimestamp - aTimestamp; // Sort by most recent first
            })
            .map((userItem) => (
            <li
              key={userItem._id}
              className="chat-list-user"
              style={{
                padding: '12px 15px',
                cursor: 'pointer',
                background: selectedUser && selectedUser._id === userItem._id ? '#eee' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin:'12px',
                borderRadius: '5px'
              }}
              onClick={() => {
                setSelectedUser(userItem);
                // Immediately clear unread count for this user
                setUnreadCounts((prev) => ({
                  ...prev,
                  [userItem._id]: 0
                }));
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {userItem.profilePicture ? (
                  <>
                  <div style={{ 
                    borderRadius: '50%', 
                    color: 'white',
                    justifyContent: 'center',
                  }}>
                  <img 
                    src={userItem.profilePicture} 
                    alt={userItem.username}
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '2px solid #ddd'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  
                  {onlineUsers.includes(userItem._id) && (
                    <span style={{ color: 'rgb(43, 216, 66)', marginLeft: -15, marginTop:'25px', fontSize: 20, position:'absolute' }}>●</span>
                    )}

                  </div>
                  </>
                ) : null}
                <div 
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: '#007AFF',
                    color: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    border: '2px solid #ddd',
                    display: userItem.profilePicture ? 'none' : 'flex'
                  }}
                >
                  {userItem.username.charAt(0).toUpperCase()}
                  
                  {onlineUsers.includes(userItem._id) && (
                  <span style={{ color: 'rgb(43, 216, 66)', marginLeft: 25, fontSize: 21,  marginTop:'30px', position:'absolute'}}>●</span>
                  )}

                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>
                    {userItem.username}
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '150px'
                  }}>
                    {getLastMessage(userItem._id)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ 
                  fontSize: '10px', 
                  color: '#999',
                  whiteSpace: 'nowrap'
                }}>
                  {getLastMessageTime(userItem._id)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getLastMessageStatus(userItem._id) && (
                    <span style={{ 
                      fontSize: '10px', 
                      color: getLastMessageStatus(userItem._id) === '✓✓' ? '#34b7f1' : '#999'
                    }}>
                      {getLastMessageStatus(userItem._id)}
                    </span>
                  )}
                  {unreadCounts[userItem._id] > 0 && (
                    <span style={{
                      backgroundColor: 'orange',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      minWidth: '20px'
                    }}>
                      {unreadCounts[userItem._id]}
              </span>
              )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        </div>

      {/* Right panel: Chat area */}
        <div style={{ 
          width: '75%',
          display: 'flex', 
          flexDirection: 'column', 
          height: 'calc(100vh - 120px)',
          overflow: 'hidden',
          backgroundColor:'white',
          borderRadius:'10px',
        }}>

        {selectedUser ? (
          <>
            {/* header */}
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid gray', padding: '2px 15px'}}> 

              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>

              {selectedUser.profilePicture ? (
                  <>
                <div style={{ 
                    borderRadius: '50%', 
                    color: 'white',
                  }}>
                  <img 
                    src={selectedUser.profilePicture} 
                    alt={selectedUser.username}
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: '2px solid #ddd'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                </div>
                </>
              ) : (
                <>
                
                <div 
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: '#007AFF',
                    color: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    border: '2px solid #ddd',
                    display: selectedUser.profilePicture ? 'none' : 'flex'
                  }}
                >
                  
                  {selectedUser.username.charAt(0).toUpperCase()}

                </div>

                </>
              )}

                    {onlineUsers.includes(selectedUser._id) && (
                    <span style={{ color: 'rgb(43, 216, 66)', marginLeft: 30, marginTop:'25px', fontSize: 20, position:'absolute' }}>●</span>
                    )}

              <h3>{selectedUser.username}</h3>
            </div>

              {isSelectionMode ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    {selectedMessages.size} selected
                  </span>
                  <button
                    onClick={handleDeleteSelectedMessages}
                    disabled={selectedMessages.size === 0}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: selectedMessages.size === 0 ? '#ccc' : '#ff4757',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedMessages.size === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete ({selectedMessages.size})
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedMessages(new Set());
                    }}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span
                  onClick={() => setClickDropdown(!clickDropdown)}
                  style={{ color: "grey", position: "relative", marginTop:'20px' }}
                >
                  <HiOutlineDotsVertical className="threedot-setting" />
                </span>
              )}
                         {clickDropdown && (
               <div
                 className="settings-dropdown-container"
                 style={{
                   position: "absolute",
                   top: "120px",
                   right: "50px",
                   zIndex: "100",
                 }}
               >
                <div>
                <div
                  className="setting-notification-container"
                  style={{
                  backgroundColor: "white",
                  width: "200px",
                  height: "210px",
                  border: "1px solid #dfd8d8",
                  padding:"10px 15px",
                  display:"flex",
                  flexDirection:"column",
                  gap:"17px"
                  }}
                >
                <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                  <IoVolumeMuteOutline  style={{color:"#4a4848"}}/>
                  <span style={{color:"#4a4848"}}>Mute Notification</span>
                </div>
                <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                  <GoClock style={{color:"#4a4848"}}/>
                  <span style={{color:"#4a4848"}}>Disappearing</span>
                </div>
                                 <div 
                   style={{display:"flex", gap:"10px", alignItems:"center", cursor:"pointer"}}
                   onClick={async () => {
                     if (window.confirm('Are you sure you want to clear all messages in this conversation?')) {
                       try {
                         const token = localStorage.getItem('token');
                         await fetch(`${backendurl}/api/messages/clear`, {
                           method: 'DELETE',
                           headers: {
                             'Content-Type': 'application/json',
                             Authorization: `Bearer ${token}`,
                           },
                           body: JSON.stringify({ 
                             from: user.id, 
                             to: selectedUser._id 
                           }),
                         });
                         
                         // Clear messages from local state
                         setMessages(prev => ({
                           ...prev,
                           [selectedUser._id]: []
                         }));
                         
                         // Close the dropdown
                         setClickDropdown(false);
                       } catch (error) {
                         console.error('Error clearing messages:', error);
                         alert('Failed to clear messages. Please try again.');
                       }
                     }
                   }}
                 >
                   <TbClearAll  style={{color:"#4a4848"}}/>
                   <span style={{color:"#4a4848"}}>Clear Message</span>
                 </div>
                                 <div 
                   style={{display:"flex", gap:"10px", alignItems:"center", cursor:"pointer"}}
                   onClick={() => {
                     setIsSelectionMode(true);
                     setSelectedMessages(new Set());
                     setClickDropdown(false);
                   }}
                 >
                   <RiDeleteBinLine  style={{color:"#4a4848"}}/>
                   <span style={{color:"#4a4848"}}>Delete Chat</span>
                 </div>
                <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                  <MdBlockFlipped  style={{color:"#4a4848"}}/>
                  <span style={{color:"#4a4848"}}>Block</span>
                </div>
                </div>
                </div>
              </div>
              )}
            </div>

            {/* message box */}
            <div 
              ref={messageContainerRef}
              style={{ 
                height: 'calc(100vh - 200px)', 
                overflow: 'auto', 
                marginBottom: 8, 
                padding: 16, 
                minHeight: '300px',
                maxHeight: 'calc(100vh - 200px)'
              }}
            >
              {(messages[selectedUser._id] || []).map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    textAlign: msg.from === user.id ? 'right' : 'left', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    flexDirection: msg.from === user.id ? 'row-reverse' : 'row',
                    position: 'relative'
                  }}
                  onClick={() => handleMessageSelection(idx)}
                >
                  {/* Selection checkbox - only show for user's own messages in selection mode */}
                  {isSelectionMode && msg.from === user.id && (
                    <input
                      type="checkbox"
                      checked={selectedMessages.has(idx)}
                      onChange={() => handleMessageSelection(idx)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        left: msg.from === user.id ? 'auto' : '5px',
                        right: msg.from === user.id ? '5px' : 'auto',
                        zIndex: 10,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {/* Profile Picture */}
                  <div style={{ flexShrink: 0 }}>
                    {msg.from === user.id ? (
                      // Current user's profile picture
                      user?.profilePicture ? (
                        <img 
                          src={user.profilePicture} 
                          alt={user?.username}
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '2px solid #ddd'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            backgroundColor: '#007bff',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            border: '2px solid #ddd'
                          }}
                        >
                          {user?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )
                    ) : (
                      // Other user's profile picture
                      selectedUser?.profilePicture ? (
                        <img 
                          src={selectedUser.profilePicture} 
                          alt={selectedUser?.username}
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            objectFit: 'cover',
                            border: '2px solid #ddd'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            backgroundColor: '#007AFF',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            border: '2px solid #ddd'
                          }}
                        >
                          {selectedUser?.username?.charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === user.id ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: msg.from === user.id ? '#aee1f9' : '#eee',
                      padding: '6px 12px',
                      borderRadius: 12,
                        margin: '2px 0',
                        wordWrap: 'break-word',
                        cursor: msg.fileUrl ? 'pointer' : 'default'
                    }}
                      onClick={msg.fileUrl ? () => window.open(msg.fileUrl, '_blank') : undefined}
                  >
                    {msg.message}
                      {msg.fileUrl && (
                        <div style={{ marginTop: '8px' }}>
                          {msg.fileType?.startsWith('image/') && (
                            <img 
                              src={msg.fileUrl} 
                              alt={msg.fileName || 'Image'} 
                              style={{ 
                                maxWidth: '200px', 
                                maxHeight: '200px', 
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(msg.fileUrl, '_blank');
                              }}
                              onError={(e) => console.error('Image failed to load:', msg.fileUrl, e)}
                              onLoad={() => console.log('Image loaded successfully:', msg.fileUrl)}
                            />
                          )}
                          {msg.fileType?.startsWith('video/') && (
                            <video 
                              src={msg.fileUrl} 
                              controls 
                              style={{ 
                                maxWidth: '200px', 
                                maxHeight: '200px', 
                                borderRadius: '4px'
                              }}
                              onError={(e) => console.error('Video failed to load:', msg.fileUrl, e)}
                              onLoad={() => console.log('Video loaded successfully:', msg.fileUrl)}
                            />
                          )}
                          {msg.fileType === 'application/pdf' && (
                            <div 
                              style={{ 
                                padding: '8px', 
                                backgroundColor: '#f0f0f0', 
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(msg.fileUrl, '_blank');
                              }}
                            >
                              📄 File
                            </div>
                          )}
                          {/* For other file types, show a clickable file icon */}
                          {!msg.fileType?.startsWith('image/') && !msg.fileType?.startsWith('video/') && msg.fileType !== 'application/pdf' && (
                            <div 
                              style={{ 
                                padding: '8px', 
                                backgroundColor: '#f0f0f0', 
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '4px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(msg.fileUrl, '_blank');
                              }}
                            >
                              📎 File
                            </div>
                          )}
                        </div>
                      )}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', color: '#666' }}>
                        {msg.timestamp ? formatTime(msg.timestamp) : ''}
                      </span>
                      {msg.from === user.id && (
                        <span style={{ fontSize: 10, color: '#666' }}>
                          {msg.read ? '✓✓' : '✓'}
                    </span>
                  )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* text message box */}
            <div style={{padding:16, borderTop:'1px solid gray'}}>
            <form onSubmit={handleSend} style={{ 
              display: 'flex', 
              marginTop: 'auto',
              position: 'sticky',
              bottom: 0,
              backgroundColor: 'white',
              padding: '8px 0',
              alignItems:'center'
            }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 8 }}
              />
              

              <GrEmoji 
                style={{ fontSize: "20px", cursor: "pointer" }} 
                onClick={toggleEmojiPicker}
              />
              {showEmojiPicker && (
                <div 
                  className="emoji-picker-container"
                  style={{
                    position: "absolute",
                    bottom: "60px",
                    left: "10px",
                    zIndex: "1000"
                  }}
                >
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              )}
              
              {/* send files */}
              <label 
                htmlFor="file-upload1" 
                className="custom-file-upload1"
                style={{ cursor: "pointer" }}
              >
                <CiFolderOn style={{ fontSize: "20px" }} />
              </label>
              <input 
                id="file-upload1" 
                type="file" 
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.avi,.mov,.wmv,.pdf"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              
              {/* File preview and upload button */}
              {selectedFile && (
                <div style={{
                  position: "absolute",
                  bottom: "60px",
                  left: "10px",
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "12px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                  zIndex: "1000",
                  minWidth: "250px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>📎 {selectedFile.name}</span>
                    <button 
                      onClick={() => setSelectedFile(null)}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        cursor: "pointer",
                        fontSize: "16px",
                        color: "#666"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                    Size: {formatFileSize(selectedFile.size)}
                  </div>
                  {selectedFile.type.startsWith('image/') && (
                    <img 
                      src={URL.createObjectURL(selectedFile)} 
                      alt="Preview" 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: "150px", 
                        borderRadius: "4px",
                        marginBottom: "8px"
                      }} 
                    />
                  )}
                  {selectedFile.type.startsWith('video/') && (
                    <video 
                      src={URL.createObjectURL(selectedFile)} 
                      controls 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: "150px", 
                        borderRadius: "4px",
                        marginBottom: "8px"
                      }}
                    />
                  )}
                  {selectedFile.type === 'application/pdf' && (
                    <div style={{ 
                      padding: "20px", 
                      backgroundColor: "#f5f5f5", 
                      borderRadius: "4px",
                      textAlign: "center",
                      marginBottom: "8px"
                    }}>
                      📄 PDF File
                    </div>
                  )}
                  <button 
                    onClick={handleFileUpload}
                    disabled={isUploading}
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: isUploading ? "#ccc" : "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: isUploading ? "not-allowed" : "pointer"
                    }}
                  >
                    {isUploading ? "Uploading..." : "Send File"}
                  </button>
                </div>
              )}

              <span
                  onClick={() => setClickDropdownTwo(!clickDropdowntwo)}
                  style={{ color: "grey", position: "relative" }}
                >
                  <HiOutlineDotsVertical style={{ fontSize: "20px" }} />
                </span>
                {clickDropdowntwo && (
                  <div
                    className="file-dropdown-container"
                    style={{
                      position: "absolute",
                      top: "-250px",
                      right: "70px",
                      zIndex: "100",
                    }}
                  >

                  {/* files options */}
                  <div>
                    <div
                      className="send-file-container"
                      style={{
                      backgroundColor: "white",
                      width: "200px",
                      height: "210px",
                      border: "1px solid #dfd8d8",
                      padding:"10px 15px",
                      display:"flex",
                      flexDirection:"column",
                      gap:"17px"
                      }}
                    >
                    <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                      <label for="file-upload2" className="custom-file-upload2">
                        <CiCamera style={{color:"#4a4848"}}/> 
                        <span style={{color:"#4a4848"}}>Camera</span>
                      </label>
                      <input 
                        id="file-upload2" 
                        type="file" 
                        accept="image/*" 
                        capture
                        style={{color:"#4a4848"}} 
                        onChange={handleFileSelect}
                      />
                    </div>
                    <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                      <label for="file-upload3" className="custom-file-upload3"><GrGallery style={{color:"#4a4848"}}/> Gallery</label>
                      <input id="file-upload3" type="file" accept=".jpg,.jpeg,.pdf" style={{color:"#4a4848"}} 
                        onChange={handleFileSelect} />
                    </div>
                    <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                      <MdOutlineAudiotrack  style={{color:"#4a4848"}}/>
                      <span style={{color:"#4a4848"}}>Audio</span>
                    </div>
                    <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                      <VscLocation  style={{color:"#4a4848"}}/>
                      <span style={{color:"#4a4848"}}>Location</span>
                    </div>
                    <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                      <RiUserFollowLine  style={{color:"#4a4848"}}/>
                      <span style={{color:"#4a4848"}}>Contact</span>
                    </div>

                    </div>
                  </div>
                </div>
                )}

              <button type="submit" style={{ padding: '8px 16px' }}>
                Send
              </button>
            </form>
            </div>

          </>
        ) : (
          <div style={{padding:60, textAlign:'center'}}>Select a user to start chatting</div>
        )}

        </div>

      </div>
    </div>
  );
};

export default Dashboard;

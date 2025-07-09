import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [profilePicture, setProfilePicture] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const navigate = useNavigate();

  const backendurl = import.meta.env.VITE_BACKEND_URL;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('username', form.username);
      formData.append('email', form.email);
      formData.append('password', form.password);
      if (profilePicture) {
        formData.append('profilePicture', profilePicture);
      }

      const res = await fetch(`${backendurl}/api/auth/register`, {
        method: 'POST',
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 20 }}>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        
        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
          
          {preview && (

            <img 
              src={preview} 
              alt="Profile Preview" 
              style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                border: '2px solid #ddd',
                marginBottom: '10px'
              }} 
            />
          )}

          <div style={{ 
              display: 'flex', 
              width: '100%', 
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
          <label>Choose Profile : </label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
          />
          </div>

        </div>
        <input 
          name="username" 
          placeholder="Full Name" 
          value={form.username} 
          onChange={handleChange} 
          required 
          style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <input 
          name="email" 
          type="email" 
          placeholder="Email" 
          value={form.email} 
          onChange={handleChange} 
          required 
          style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <input 
          name="password" 
          type="password" 
          placeholder="Password" 
          value={form.password} 
          onChange={handleChange} 
          required 
          style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <button 
          type="submit"
          style={{ 
            width: '105%', 
            padding: '10px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Register
        </button>
      </form>
      {error && <div style={{ color: 'red', marginTop: '10px', textAlign: 'center' }}>{error}</div>}
    </div>
  );
};

export default Register;

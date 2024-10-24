import React, { useState } from 'react';

const UserManagement = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profile, setProfile] = useState('');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const response = await fetch('http://localhost:5000/create_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        email,
        firstName,
        lastName,
        dateOfBirth,
        profile,
      }),
    });
    const data = await response.json();
    if (data.status === 'success') {
      alert('User created successfully');
    } else {
      alert('Error creating user');
    }
  };

  return (
    <div className="user-management">
      <h2>Create New User</h2>
      <form onSubmit={handleCreateUser}>
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input type="date" placeholder="Date of Birth" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        <select value={profile} onChange={(e) => setProfile(e.target.value)}>
          <option value="system_admin">System Admin</option>
          <option value="traffic_analyst">Traffic Analyst</option>
          <option value="urban_planner">Urban Planner</option>
          <option value="data_engineer">Data Engineer</option>
          <option value="traffic_management_user">Traffic Management User</option>
        </select>
        <button type="submit">Create User</button>
      </form>
    </div>
  );
};

export default UserManagement;

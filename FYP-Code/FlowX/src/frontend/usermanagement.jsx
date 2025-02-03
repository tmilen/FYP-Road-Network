import React, { useState } from 'react';
import styles from '../css/usermanagement.module.css'; 
import Navbar from './navbar';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import UserManagementController from '../components/usermanagement';  
import { MdOutlineModeEdit, MdOutlineCancel, MdDeleteOutline } from "react-icons/md";
import { FaRegSave } from "react-icons/fa";
import { ToastContainer, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const UserManagement = () => {
    const [activeView, setActiveView] = useState('users'); // Add this line at the top with other states
    const {
        users,
        profiles,
        editUserId,
        editableUser,
        searchQuery, 
        filteredUsers,
        filteredProfiles,
        setEditableProfileName,
        handleCancelEdit,
        formatPermissionKey,
        handleProfileSearch,
        setProfileSearchQuery,
        setSearchQuery,
        setEditableUser,
        handleUserSearch,
        handleEditClick,
        handleSaveClick,
        deleteUser,
        deleteProfile,
        handleInputChange,
        handleProfileInputChange,
        handleSubmitUser,
        handleSubmitProfile,
        handleDateChange,
        handleFeatureToggle,
        handleEditProfile,
        handleSaveProfile,
        handleCancelProfileEdit,
        features,
        maxDate,
        date,
        newUser,
        newProfile,
        editProfileId,
        editableProfileName,
        profileSearchQuery,
        errorMessage,
        userErrorMessage,
        profileErrorMessage,
        clearUserFields,
        clearProfileFields,
        searchMessage,
        deleteProfileMessage,
        createUserMessage,
        allUsersMessage,
        createProfileMessage,
        allProfilesMessage,
        userSearchMessage,
        profileSearchMessage,
    } = UserManagementController(); 

    const [showEmailError, setShowEmailError] = useState(false);

    const handleEmailChange = (e) => {
        handleInputChange(e);
        setShowEmailError(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value));
    };

    const handleSubmitUserWithValidation = (event) => {
        event.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
            setShowEmailError(true);
            return;
        }
        setShowEmailError(false);
        handleSubmitUser(event);
    };

    return (
        <div className={styles.pageContainer}>
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                transition={Bounce}
            />
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.usermanagementContainer}>
                <div className={styles.contentPanel}>
                    <div className={styles.viewToggle}>
                        <button 
                            className={`${styles.toggleButton} ${activeView === 'users' ? styles.active : ''}`}
                            onClick={() => setActiveView('users')}
                        >
                            Users
                        </button>
                        <button 
                            className={`${styles.toggleButton} ${activeView === 'profiles' ? styles.active : ''}`}
                            onClick={() => setActiveView('profiles')}
                        >
                            Profiles
                        </button>
                    </div>

                    {activeView === 'users' ? (
                        <div className={styles.viewContent}>
                            {/* Create New User Form */}
                            <div className={styles.usermanagementBox}>
                                <h2>Create New User</h2>
                                <form onSubmit={handleSubmitUserWithValidation}>
                                    <div className={styles.inputGroup}>
                                        <label>Username</label>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="text"
                                                name="username"
                                                value={newUser.username}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Password</label>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="password"
                                                name="password"
                                                value={newUser.password}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Email</label>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="email"
                                                name="email"
                                                value={newUser.email}
                                                onChange={handleEmailChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>First Name</label>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="text"
                                                name="first_name"
                                                value={newUser.first_name}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Last Name</label>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                type="text"
                                                name="last_name"
                                                value={newUser.last_name}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Date of Birth</label>
                                        <Calendar
                                            onChange={handleDateChange}
                                            value={date}
                                            maxDate={maxDate}
                                            className={styles.customCalendar} 
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>User Profile</label>
                                        <div className={styles.inputWrapper}>
                                            <select
                                                name="user_profile"
                                                value={newUser.user_profile}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                {profiles.map((profile) => (
                                                    <option 
                                                        key={profile.user_profile} 
                                                        value={profile.user_profile.toLowerCase().replace(/\s+/g, '_')}
                                                    >
                                                        {profile.user_profile}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.buttonGroup}>
                                        <button type="submit" className={styles.createUserButton}>Create User</button>
                                        <button type="button" className={styles.clearButton} onClick={clearUserFields}>Clear</button>
                                    </div>
                                    {showEmailError && (
                                        <div className={styles.errorMessage}>Invalid email format</div>
                                    )}
                                    {createUserMessage && (
                                        <div className={createUserMessage.includes("successfully") ? styles.successMessage : styles.errorMessage}>
                                            {createUserMessage}
                                        </div>
                                    )}
                                </form>
                            </div>

                            {/* All Users Table */}
                            <div className={styles.usermanagementBox}>
                                <h2>All Users</h2>
                                <div className={styles.searchContainer}>
                                    <input
                                        type="text"
                                        placeholder="Search Users"
                                        className={styles.searchInput}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <button className={styles.searchButton} onClick={() => handleUserSearch()}>Search</button>
                                    <button className={styles.clearButton} onClick={() => setSearchQuery('')}>Clear</button>
                                    {userSearchMessage && (
                                        <div className={
                                            userSearchMessage === "User found" || userSearchMessage === "User updated successfully"
                                                ? styles.successMessage
                                                : styles.errorMessage
                                        }>
                                            {userSearchMessage}
                                        </div>
                                    )}
                                    {allUsersMessage && (
                                        <div className={allUsersMessage.includes("successfully") ? styles.successMessage : styles.errorMessage}>
                                            {allUsersMessage}
                                        </div>
                                    )}
                                    {userErrorMessage && (
                                        <div className={styles.errorMessage}>
                                            {userErrorMessage}
                                        </div>
                                    )}
                                </div>
                                <table className={styles.userTable}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>First Name</th>
                                            <th>Last Name</th>
                                            <th>Date of Birth</th>
                                            <th>Profile</th>
                                            <th>Permissions</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {(filteredUsers.length > 0 ? filteredUsers : users).map((user) => (
                                            <tr key={user.id}>
                                                <td>{user.id}</td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <input
                                                            type="text"
                                                            name="username"
                                                            value={editableUser.username}
                                                            onChange={(e) => setEditableUser({ ...editableUser, username: e.target.value })}
                                                        />
                                                    ) : (
                                                        user.username
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <input
                                                            type="email"
                                                            name="email"
                                                            value={editableUser.email}
                                                            onChange={(e) => setEditableUser({ ...editableUser, email: e.target.value })}
                                                        />
                                                    ) : (
                                                        user.email
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <input
                                                            type="text"
                                                            name="first_name"
                                                            value={editableUser.first_name}
                                                            onChange={(e) => setEditableUser({ ...editableUser, first_name: e.target.value })}
                                                        />
                                                    ) : (
                                                        user.first_name
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <input
                                                            type="text"
                                                            name="last_name"
                                                            value={editableUser.last_name}
                                                            onChange={(e) => setEditableUser({ ...editableUser, last_name: e.target.value })}
                                                        />
                                                    ) : (
                                                        user.last_name
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <input
                                                            type="date"
                                                            name="date_of_birth"
                                                            value={editableUser.date_of_birth}
                                                            onChange={(e) => setEditableUser({ ...editableUser, date_of_birth: e.target.value })}
                                                        />
                                                    ) : (
                                                        user.date_of_birth
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        <select
                                                            value={editableUser.user_profile}
                                                            onChange={(e) => setEditableUser({ ...editableUser, user_profile: e.target.value })}
                                                        >
                                                            {profiles.map((profile) => (
                                                                <option key={profile.id} value={profile.user_profile}>
                                                                    {profile.user_profile}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        user.user_profile
                                                    )}
                                                </td>
                                                <td>
                                                    {editUserId === user.id ? (
                                                        // When editing, show non-editable permissions from profile
                                                        <ol className={styles.permissionList}>
                                                            {Object.entries(editableUser.permissions || {})
                                                                .filter(([_, value]) => value)
                                                                .map(([key], i) => (
                                                                    <li key={i}>{formatPermissionKey(key)}</li>
                                                                ))}
                                                        </ol>
                                                    ) : (
                                                        <ol className={styles.permissionList}>
                                                            {Object.entries(user.permissions || {})
                                                                .filter(([_, value]) => value)
                                                                .map(([key], i) => (
                                                                    <li key={i}>{formatPermissionKey(key)}</li>
                                                                ))}
                                                        </ol>
                                                    )}
                                                </td>

                                                <td>
                                                    {user.user_profile !== 'system_admin' ? (
                                                        editUserId === user.id ? (
                                                            <div className={styles.buttonGroup}>
                                                                <button onClick={handleSaveClick} className={styles.saveButton}>
                                                                    <FaRegSave />
                                                                </button>
                                                                <button onClick={handleCancelEdit} className={styles.cancelButton}>
                                                                    <MdOutlineCancel />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className={styles.buttonGroup}>
                                                                <button onClick={() => handleEditClick(user)} className={styles.editButton}>
                                                                    <MdOutlineModeEdit />
                                                                </button>
                                                                <button onClick={() => deleteUser(user.id)} className={styles.deleteButton}>
                                                                    <MdDeleteOutline />
                                                                </button>
                                                            </div>
                                                        )
                                                    ) : (
                                                        null
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.viewContent}>
                            {/* Create New Profile Form */}
                            <div className={styles.usermanagementBox}>
                                <h2>Create New Profile</h2>
                                <form onSubmit={handleSubmitProfile}>
                                    <div className={styles.inputGroup}>
                                        <label>Profile Name</label>
                                        <div className={styles.inputWrapper}>
                                        <input
                                            type="text"
                                            value={newProfile}
                                            onChange={handleProfileInputChange}
                                            placeholder="Enter profile name"
                                        />
                                        </div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Permissions Setting</label>
                                        <div className={styles.inputWrapper}>
                                            <ul className={styles.permissionsList}>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Traffic Management</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.traffic_management}
                                                    onChange={() => handleFeatureToggle('traffic_management')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Data Health</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.data_health}
                                                    onChange={() => handleFeatureToggle('data_health')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Traffic Data</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.traffic_data}
                                                    onChange={() => handleFeatureToggle('traffic_data')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Reports</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.report}
                                                    onChange={() => handleFeatureToggle('report')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Live Map</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.live_map}
                                                    onChange={() => handleFeatureToggle('live_map')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            <li className={styles.permissionItem}>
                                                <label className={styles.permissionsLabel}>Upload Map</label>
                                                <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    checked={features.upload_map}
                                                    onChange={() => handleFeatureToggle('upload_map')}
                                                />
                                                <span className={`${styles.slider} ${styles.round}`}></span>
                                                </label>
                                            </li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className={styles.buttonGroup}>
                                        <button type="submit" className={styles.createProfileButton}>Create Profile</button>
                                        <button type="button" className={styles.clearButton} onClick={clearProfileFields}>Clear</button>
                                    </div>
                                    {createProfileMessage && (
                                        <div className={createProfileMessage.includes("successfully") ? styles.successMessage : styles.errorMessage}>
                                            {createProfileMessage}
                                        </div>
                                    )}
                                </form>
                            </div>

                            {/* All Profiles Table */}
                            <div className={styles.usermanagementBox}>
                                <h2>All Profiles</h2>
                                <div className={styles.searchContainer}>
                                    <input
                                        type="text"
                                        placeholder="Search Profiles"
                                        className={styles.searchInput} 
                                        value={profileSearchQuery}
                                        onChange={(e) => setProfileSearchQuery(e.target.value)}
                                    />
                                    <button className={styles.searchButton} onClick={handleProfileSearch}>Search</button>
                                    <button className={styles.clearButton} onClick={() => setProfileSearchQuery('')}>Clear</button>
                                    {profileSearchMessage && (
                                        <div className={
                                            profileSearchMessage === "Profile found" || profileSearchMessage === "Profile updated successfully"
                                                ? styles.successMessage // Ensure successMessage is used for green color
                                                : styles.errorMessage
                                        }>
                                            {profileSearchMessage}
                                        </div>
                                    )}
                                    {allProfilesMessage && (
                                        <div className={allProfilesMessage === "Profile updated successfully" || allProfilesMessage.includes("successfully") ? styles.successMessage : styles.errorMessage}>
                                            {allProfilesMessage}
                                        </div>
                                    )}
                                    {profileErrorMessage && (
                                        <div className={styles.errorMessage}>
                                            {profileErrorMessage}
                                        </div>
                                    )}
                                </div>
                                <table className={`${styles.userTable} ${styles.profileTable}`}>
                                    <thead>
                                        <tr>
                                            <th>Profile ID</th>
                                            <th>Profile Name</th>
                                            <th>Permissions</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(filteredProfiles.length > 0 ? filteredProfiles : profiles).map((profile, index) => (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>
                                                    {editProfileId === profile.user_profile ? (
                                                        <input
                                                            type="text"
                                                            value={editableProfileName}
                                                            onChange={(e) => setEditableProfileName(e.target.value)}
                                                            className={styles.editProfileInput}
                                                        />
                                                    ) : (
                                                        profile.user_profile
                                                    )}
                                                </td>
                                                <td>
                                                    <ol className={styles.permissionList}>
                                                        {Object.entries(profile.permissions || {})
                                                            .filter(([_, value]) => value)
                                                            .map(([key], i) => (
                                                                <li key={i}>{formatPermissionKey(key)}</li>
                                                            ))}
                                                    </ol>
                                                </td>
                                                <td>
                                                    {editProfileId === profile.user_profile ? (
                                                        <div className={styles.buttonGroup}>
                                                            <button
                                                                className={styles.saveButton}
                                                                onClick={() => handleSaveProfile(profile.user_profile)}
                                                            >
                                                                <FaRegSave />
                                                            </button>
                                                            <button
                                                                className={styles.cancelButton}
                                                                onClick={handleCancelProfileEdit}
                                                            >
                                                                <MdOutlineCancel />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className={styles.buttonGroup}>
                                                            <button
                                                                className={styles.editButton}
                                                                onClick={() => handleEditProfile(profile.user_profile)}
                                                            >
                                                                <MdOutlineModeEdit />
                                                            </button>
                                                            <button
                                                                className={styles.deleteButton}
                                                                onClick={() => deleteProfile(profile.user_profile)}
                                                            >
                                                                <MdDeleteOutline />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );    
};

export default UserManagement;
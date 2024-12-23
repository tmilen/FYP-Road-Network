import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const UserManagementController = () => {
    const [users, setUsers] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [editUserId, setEditUserId] = useState(null);
    const [editableUser, setEditableUser] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [profileSearchQuery, setProfileSearchQuery] = useState('');
    const [editProfileId, setEditProfileId] = useState(null);
    const [editableProfileName, setEditableProfileName] = useState('');
    const [filteredProfiles, setFilteredProfiles] = useState([]);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        email: '',
        first_name: '',
        last_name: '',
        date_of_birth: '',
        user_profile: 'traffic_management_user'
    });
    const [newProfile, setNewProfile] = useState('');
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);
    const [date, setDate] = useState(maxDate);
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState(null);
    const [userErrorMessage, setUserErrorMessage] = useState(null);
    const [profileErrorMessage, setProfileErrorMessage] = useState(null);
    const [userSearchMessage, setUserSearchMessage] = useState(null);
    const [profileSearchMessage, setProfileSearchMessage] = useState(null);
    const [deleteProfileMessage, setDeleteProfileMessage] = useState(null);
    const [createUserMessage, setCreateUserMessage] = useState(null);
    const [allUsersMessage, setAllUsersMessage] = useState(null);
    const [createProfileMessage, setCreateProfileMessage] = useState(null);
    const [allProfilesMessage, setAllProfilesMessage] = useState(null);

    const API_URL = process.env.REACT_APP_API_URL;
    
    useEffect(() => {
        axios.get(`${API_URL}/session`, { withCredentials: true })
            .then(response => {
                console.log("Debug: User session data:", response.data);
    
                // Check if the user has 'manage_users' permission
                const permissions = response.data.permissions;
                if (!permissions || !permissions.manage_users) {
                    console.log("Debug: User does not have manage_users permission");
                    navigate('/'); // Redirect if permission is not granted
                } else {
                    console.log("Debug: User has manage_users permission");
                }
            })
            .catch(error => {
                console.error("Error fetching session data", error);
                navigate('/'); // Redirect on error
            });
    }, [API_URL, navigate]);
    

    useEffect(() => {
        fetchUsers();
        fetchProfiles();
    }, []);

    // Reset if the search query is cleared
    useEffect(() => {
        if (searchQuery === '') {
            setFilteredUsers([]);
            setUserSearchMessage(null);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (profileSearchQuery === '') {
            setFilteredProfiles([]);
            setProfileSearchMessage(null);
        }
    }, [profileSearchQuery]);

    const [features, setFeatures] = useState({
        traffic_management: true,
        manage_users: false,
        data_health: false,
        urban_planning: false,
    });

    const handleFeatureToggle = (feature) => {
        setFeatures(prev => {
            const updatedFeatures = {
                ...prev,
                [feature]: !prev[feature],
            };

            // If editing a user, update the editableUser state with the new features
            if (editUserId !== null) {
                setEditableUser(prevEditableUser => ({
                    ...prevEditableUser,
                    permissions: {
                        ...prevEditableUser.permissions,
                        [feature]: updatedFeatures[feature]
                    }
                }));
            }

            return updatedFeatures;
        });
    };

    const formatPermissionKey = (key) => {
        // Capitalizes and replaces underscores with spaces
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Start editing a profile
    const handleEditProfile = (profileName) => {
        setEditProfileId(profileName);
        setEditableProfileName(profileName); // Set the current name in the input field
    };

    // Save profile changes
const handleSaveProfile = (oldProfileName) => {
    const formattedOldProfileName = oldProfileName.toLowerCase().replace(/\s+/g, '_');
    const formattedNewProfileName = editableProfileName.toLowerCase().replace(/\s+/g, '_');

    // Check if the edited profile name already exists
    const existingProfile = profiles.find(profile => profile.user_profile === formattedNewProfileName && profile.user_profile !== formattedOldProfileName);
    if (existingProfile) {
        setProfileErrorMessage("Profile name already exists");
        clearMessageAfterTimeout(setProfileErrorMessage);
        return;
    }

    axios.put(`${API_URL}/profiles/${formattedOldProfileName}`, { user_profile: formattedNewProfileName }, { withCredentials: true })
        .then((response) => {
            setAllProfilesMessage("Profile updated successfully"); // Ensure the message text matches the condition
            setEditProfileId(null); // Exit edit mode
            setEditableProfileName('');
            clearMessageAfterTimeout(setAllProfilesMessage);

            // Update profiles and filteredProfiles
            setProfiles(prevProfiles =>
                prevProfiles.map(profile =>
                    profile.user_profile === oldProfileName
                        ? { ...profile, user_profile: formattedNewProfileName }
                        : profile
                )
            );
            // Also update filteredProfiles if a search is active
            setFilteredProfiles(prevFilteredProfiles =>
                prevFilteredProfiles.map(profile =>
                    profile.user_profile === oldProfileName
                        ? { ...profile, user_profile: formattedNewProfileName }
                        : profile
                )
            );
        })
        .catch(error => {
            setProfileErrorMessage("Profile name already exists");
            clearMessageAfterTimeout(setProfileErrorMessage);
        });
};


    // Cancel editing
    const handleCancelProfileEdit = () => {
        setEditProfileId(null);
        setEditableProfileName('');
    };

    // Fetch users from the server, including their permissions
    const fetchUsers = async () => {
        try {
            // First, fetch all users
            const usersResponse = await axios.get(`${API_URL}/users`, { withCredentials: true });
            const usersData = usersResponse.data;

            // Fetch permissions for each user and add to their data
            const usersWithPermissions = await Promise.all(
                usersData.map(async (user) => {
                    try {
                        // Fetch the permissions for each user
                        const permissionsResponse = await axios.get(`${API_URL}/permissions/${user.id}`, { withCredentials: true });
                        return { 
                            ...user, 
                            permissions: permissionsResponse.data,
                            user_profile: user.user_profile.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                        };
                    } catch (error) {
                        console.error(`Error fetching permissions for user ${user.id}:`, error);
                        return { 
                            ...user, 
                            permissions: null, // If permissions fetch fails, set permissions to null
                            user_profile: user.user_profile.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                        };
                    }
                })
            );

            // Update state with users and their permissions
            setUsers(usersWithPermissions);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };


    // Fetch profiles from the server
    const fetchProfiles = () => {
        axios.get(`${API_URL}/profiles`, { withCredentials: true })
            .then(response => {
                const formattedProfiles = response.data.map(profile => ({
                    ...profile,
                    user_profile: profile.user_profile.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                }));
                setProfiles(formattedProfiles);
            })
            .catch(error => console.error("Error fetching profiles:", error));
    };

    // Function to handle search input and filter users
    const handleUserSearch = async () => {
        if (!searchQuery.trim()) {
            setUserSearchMessage("Search field can't be empty");
            clearMessageAfterTimeout(setUserSearchMessage);
            return;
        }
    
        try {
            const response = await axios.get(`${API_URL}/search-users`, {
                params: { query: searchQuery },
                withCredentials: true
            });
            const filtered = response.data;
            setFilteredUsers(filtered);
            setUserSearchMessage(filtered.length > 0 ? "User found" : "User not found");
            clearMessageAfterTimeout(setUserSearchMessage);
            return filtered;
        } catch (error) {
            console.error("Error searching users:", error);
            setUserSearchMessage("Error searching users");
            clearMessageAfterTimeout(setUserSearchMessage);
            return [];
        }
    };
    
    // Function to handle profile search
    const handleProfileSearch = async () => {
        if (!profileSearchQuery.trim()) {
            setProfileSearchMessage("Search field can't be empty");
            clearMessageAfterTimeout(setProfileSearchMessage);
            return;
        }
    
        try {
            const response = await axios.get(`${API_URL}/search-profiles`, {
                params: { query: profileSearchQuery },
                withCredentials: true
            });
            const filtered = response.data;
            setFilteredProfiles(filtered);
            setProfileSearchMessage(filtered.length > 0 ? "Profile found" : "Profile not found");
            clearMessageAfterTimeout(setProfileSearchMessage);
            return filtered;
        } catch (error) {
            console.error("Error searching profiles:", error);
            setProfileSearchMessage("Error searching profiles");
            clearMessageAfterTimeout(setProfileSearchMessage);
            return [];
        }
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setNewUser({
            ...newUser,
            [name]: name === 'first_name' || name === 'last_name'
                ? value.charAt(0).toUpperCase() + value.slice(1)
                : value
        });
    };

    const handleProfileInputChange = (event) => setNewProfile(event.target.value);

    const handleDateChange = (selectedDate) => {
        setDate(selectedDate);
        setNewUser({ ...newUser, date_of_birth: selectedDate.toISOString().split('T')[0] });
    };

    const clearMessageAfterTimeout = (setMessageFunction) => {
        setTimeout(() => {
            setMessageFunction(null);
        }, 7000);
    };

    const handleSubmitUser = (event) => {
        event.preventDefault();
        
        // Combine newUser data with features to send all information in one request
        const userData = {
            ...newUser,
            permissions: {
                traffic_management: features.traffic_management,
                data_health: features.data_health,
                manage_users: features.manage_users,
                urban_planning: features.urban_planning
            }
        };
    
        // Debugging statement to log userData
        console.log("Submitting user data:", userData);
    
        // Check if required fields are empty
        const requiredFields = ['username', 'password', 'email', 'first_name', 'last_name'];
        if (!requiredFields.every(field => userData[field])) {
            setCreateUserMessage("All fields are required");
            clearMessageAfterTimeout(setCreateUserMessage);
            return;
        }
    
        // Check if email format is valid
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(userData.email)) {
            setCreateUserMessage("Invalid email format");
            clearMessageAfterTimeout(setCreateUserMessage);
            return;
        }
    
        axios.post(`${API_URL}/users`, userData, { withCredentials: true })
            .then((response) => {
                fetchUsers(); 
                setNewUser({
                    username: '',
                    password: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    date_of_birth: '',
                    user_profile: 'traffic_management_user'
                });
                setFeatures({
                    traffic_management: true,
                    data_health: false,
                    manage_users: false,
                    urban_planning: false,
                });
    
                setCreateUserMessage("User created successfully");
                clearMessageAfterTimeout(setCreateUserMessage);
            })
            .catch(error => {
                if (error.response && error.response.data && error.response.data.message) {
                    setCreateUserMessage(error.response.data.message);
                } else {
                    setCreateUserMessage("Error creating user: " + (error.response?.data?.message || error.message));
                }
                clearMessageAfterTimeout(setCreateUserMessage);
            });
    };

    const handleSubmitProfile = (event) => {
        event.preventDefault();
        
        // Check if profile name is empty
        if (!newProfile) {
            setCreateProfileMessage("Profile name is required");
            clearMessageAfterTimeout(setCreateProfileMessage);
            return;
        }

        // Convert profile name to lowercase and replace spaces with underscores
        const formattedProfileName = newProfile.trim().toLowerCase().replace(/\s+/g, '_');

        // Clear delete profile message
        setDeleteProfileMessage(null);

        axios.post(`${API_URL}/profiles`, { user_profile: formattedProfileName }, { withCredentials: true })
            .then((response) => {
                setCreateProfileMessage(response.data.message || "Profile created successfully"); 
                setNewProfile(''); 
                fetchProfiles(); 
                clearMessageAfterTimeout(setCreateProfileMessage);
            })
            .catch(error => {
                const errorMessage = error.response?.data?.message || error.message;
                setCreateProfileMessage(errorMessage.includes("Profile already exists") ? errorMessage : "Error creating profile: " + errorMessage);
                clearMessageAfterTimeout(setCreateProfileMessage);
            });
    };

    const deleteProfile = (profileName) => {
        const formattedProfileName = profileName.toLowerCase().replace(/\s+/g, '_');

        // Clear create profile message
        setProfileErrorMessage(null);

        axios.delete(`${API_URL}/profiles/${formattedProfileName}`, { withCredentials: true })
        .then((response) => {
            setAllProfilesMessage(response.data.message || "Profile deleted successfully"); 
            fetchProfiles(); 
            clearMessageAfterTimeout(setAllProfilesMessage);
        })
        .catch(error => {
            setAllProfilesMessage("Error deleting profile: " + (error.response?.data?.message || error.message));
            clearMessageAfterTimeout(setAllProfilesMessage);
        });
    };

    const deleteUser = (userId) => {
        axios.delete(`${API_URL}/users/${userId}`, { withCredentials: true })
            .then((response) => {
                if (response.status === 200) {
                    setAllUsersMessage("User deleted successfully"); 
                    fetchUsers();
                    clearMessageAfterTimeout(setAllUsersMessage);
                }
            })
            .catch(error => {
                setAllUsersMessage("Failed to delete user");
                clearMessageAfterTimeout(setAllUsersMessage);
            });
    };

    const handleEditClick = (user) => {
        setEditUserId(user.id);
        setEditableUser({ ...user });

        setFeatures({
            traffic_management: user.permissions?.traffic_management || false,
            data_health: user.permissions?.data_health || false,
            manage_users: user.permissions?.manage_users || false,
            urban_planning: user.permissions?.urban_planning || false,
        });
    };

    const handleCancelEdit = () => {
        setEditUserId(null);        
        setEditableUser({});        
        setFeatures({                
            traffic_management: true,
            data_health: false,
            manage_users: false,
            urban_planning: false,
        });
        setUserErrorMessage(null); // Clear the error message
    };
    
    const handleSaveClick = () => {
        const updatedUserData = {
            ...editableUser,  
            ...features       
        };
    
        // Check if the edited username or email already exists
        const existingUserByUsername = users.find(user => user.username === updatedUserData.username && user.id !== editUserId);
        const existingUserByEmail = users.find(user => user.email === updatedUserData.email && user.id !== editUserId);
    
        if (existingUserByUsername) {
            setUserErrorMessage("Username already exists");
            return;
        }
    
        if (existingUserByEmail) {
            setUserErrorMessage("Email already exists");
            return;
        }

        // Check if email format is valid
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(updatedUserData.email)) {
            setUserErrorMessage("Invalid email format");
            return;
        }
    
        axios.put(`${API_URL}/users/${editUserId}`, updatedUserData, { withCredentials: true })
            .then((response) => {
                if (response.status === 200) {
                    setAllUsersMessage("User updated successfully"); 
                    fetchUsers();  
                    setEditUserId(null);
                    setEditableUser({});
                    setFeatures({
                        traffic_management: true,
                        data_health: false,
                        manage_users: false,
                        urban_planning: false,
                    });
                    clearMessageAfterTimeout(setAllUsersMessage); // Clear the message after a timeout

                    // Update users and filteredUsers to reflect the changes
                    setUsers(prevUsers => 
                        prevUsers.map(user => 
                            user.id === editUserId ? { ...user, ...updatedUserData } : user
                        )
                    );
                    setFilteredUsers(prevFilteredUsers => 
                        prevFilteredUsers.map(user => 
                            user.id === editUserId ? { ...user, ...updatedUserData } : user
                        )
                    );
                } else {
                    setUserErrorMessage("Failed to save changes: Unexpected response from server");
                }
            })
            .catch(error => {
                console.error("Error saving changes:", error); 
                setUserErrorMessage("Failed to save changes: " + (error.response?.data?.message || error.message));
            });
    };
    
    const clearUserFields = () => {
        setNewUser({
            username: '',
            password: '',
            email: '',
            first_name: '',
            last_name: '',
            date_of_birth: '',
            user_profile: 'traffic_management_user'
        });
        setFeatures({
            traffic_management: true,
            data_health: false,
            manage_users: false,
            urban_planning: false,
        });
    };

    const clearProfileFields = () => {
        setNewProfile('');
    };

    return {
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
        userSearchMessage,
        profileSearchMessage,
        deleteProfileMessage,
        createUserMessage,
        allUsersMessage,
        createProfileMessage,
        allProfilesMessage
    };
};

export default UserManagementController;

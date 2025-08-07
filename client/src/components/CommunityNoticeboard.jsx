// Filename: CommunityNoticeboard.jsx
import React, { useState, useEffect } from 'react';
// Import necessary Firebase functions
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, collection, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

// Lucide-react icons for the UI
import { Plus, Calendar, Megaphone, Search, MessageCircle, X, Edit, Trash2, Loader } from 'lucide-react';

// Get Firebase configuration and app ID from the environment
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Initialize Firebase app, Firestore, and Auth instances
const app = firebaseConfig.projectId ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

const CommunityNoticeboard = () => {
  // UI state for managing the application's interactive elements
  const [activeSection, setActiveSection] = useState('announcements');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore data state to hold the content from the database
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [lostFound, setLostFound] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  // Authenticate user with the provided custom token
  useEffect(() => {
    // Check if Firebase is properly configured
    if (!app || !auth) {
      console.error("Firebase is not configured. Please check your firebaseConfig.");
      return;
    }

    const signInUser = async () => {
      try {
        if (initialAuthToken) {
          // Sign in using the custom authentication token
          await signInWithCustomToken(auth, initialAuthToken);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    signInUser();

    // Set up a listener for authentication state changes to get the user ID
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
      setIsAuthReady(true);
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribeAuth();
  }, []);

  // Set up real-time data listeners for each section using Firestore's onSnapshot
  useEffect(() => {
    // Only proceed if Firebase is ready and the user is authenticated
    if (!db || !userId) return;

    setIsLoading(true);

    // Base path for public data in Firestore
    const basePath = `/artifacts/${appId}/public/data/`;

    // Announcements listener: Fetches data and updates state in real-time
    const unsubscribeAnnouncements = onSnapshot(collection(db, `${basePath}announcements`), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(docs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      setIsLoading(false);
    });

    // Events listener
    const unsubscribeEvents = onSnapshot(collection(db, `${basePath}events`), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(docs);
    }, (error) => {
      console.error("Error fetching events:", error);
    });

    // Lost & Found listener
    const unsubscribeLostFound = onSnapshot(collection(db, `${basePath}lost-found`), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLostFound(docs);
    }, (error) => {
      console.error("Error fetching lost & found:", error);
    });

    // Feedback listener
    const unsubscribeFeedbacks = onSnapshot(collection(db, `${basePath}feedback`), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedbacks(docs);
    }, (error) => {
      console.error("Error fetching feedback:", error);
    });

    // Clean up all listeners on component unmount
    return () => {
      unsubscribeAnnouncements();
      unsubscribeEvents();
      unsubscribeLostFound();
      unsubscribeFeedbacks();
    };
  }, [db, userId]); // Re-run effect when db or userId changes

  // Form handling functions
  const resetForm = () => {
    setFormData({});
    setShowForm(false);
    setEditingItem(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Ensure Firestore and user authentication are ready before proceeding
    if (!db || !userId) {
      console.error("Firestore not ready or user not authenticated.");
      return;
    }

    const collectionPath = `/artifacts/${appId}/public/data/`;
    let collectionRef;

    // Determine the correct Firestore collection based on the active section
    switch (activeSection) {
      case 'announcements':
        collectionRef = collection(db, `${collectionPath}announcements`);
        break;
      case 'events':
        collectionRef = collection(db, `${collectionPath}events`);
        break;
      case 'lostfound':
        collectionRef = collection(db, `${collectionPath}lost-found`);
        break;
      case 'feedback':
        collectionRef = collection(db, `${collectionPath}feedback`);
        break;
      default:
        return;
    }

    // Create a new item object from the form data
    const newItem = {
      ...formData,
      date: formData.date || new Date().toISOString().split('T')[0],
      author: isAdmin ? 'Admin' : 'Anonymous', // Author is 'Admin' if in admin mode, otherwise 'Anonymous'
      createdAt: new Date() // Add a timestamp for ordering
    };

    try {
      if (editingItem) {
        // Update an existing document if an item is being edited
        await setDoc(doc(db, collectionRef.path, editingItem.id), newItem, { merge: true });
        console.log("Document updated with ID: ", editingItem.id);
      } else {
        // Add a new document to the collection
        const docRef = await addDoc(collectionRef, newItem);
        console.log("Document written with ID: ", docRef.id);
      }
    } catch (e) {
      console.error("Error adding/updating document: ", e);
    }
    // Reset the form after submission
    resetForm();
  };

  const handleEdit = (item) => {
    // Set the editing item and populate the form
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    // Ensure Firestore and user authentication are ready before deleting
    if (!db || !userId) {
      console.error("Firestore not ready or user not authenticated.");
      return;
    }
    
    let collectionName;
    // Determine the collection name for the item to be deleted
    switch (activeSection) {
      case 'announcements':
        collectionName = 'announcements';
        break;
      case 'events':
        collectionName = 'events';
        break;
      case 'lostfound':
        collectionName = 'lost-found';
        break;
      case 'feedback':
        collectionName = 'feedback';
        break;
      default:
        return;
    }
    
    try {
      // Create a document reference and delete the document
      const docRef = doc(db, `/artifacts/${appId}/public/data/${collectionName}`, id);
      await deleteDoc(docRef);
      console.log("Document with ID", id, "deleted successfully.");
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  // Helper function to get the current data array based on the active section
  const getCurrentData = () => {
    switch (activeSection) {
      case 'announcements': return announcements;
      case 'events': return events;
      case 'lostfound': return lostFound;
      case 'feedback': return feedbacks;
      default: return [];
    }
  };

  // Helper function to get the title for the current section
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'announcements': return 'Announcements';
      case 'events': return 'Events';
      case 'lostfound': return 'Lost & Found';
      case 'feedback': return 'Feedback';
      default: return '';
    }
  };

  // Helper function to get the icon for the current section
  const getSectionIcon = () => {
    switch (activeSection) {
      case 'announcements': return <Megaphone className="w-5 h-5"/>;
      case 'events': return <Calendar className="w-5 h-5" />;
      case 'lostfound': return <Search className="w-5 h-5" />;
      case 'feedback': return <MessageCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  // Function to render the correct form based on the active section
  const renderForm = () => {
    switch (activeSection) {
      case 'announcements':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingItem ? 'Edit Announcement' : 'New Announcement'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority || 'medium'}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingItem ? 'Update' : 'Post'} Announcement
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'events':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingItem ? 'Edit Event' : 'New Event'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date || ''}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.time || ''}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingItem ? 'Update' : 'Post'} Event
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'lostfound':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingItem ? 'Edit Lost & Found' : 'New Lost & Found'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type || 'lost'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="lost">Lost</option>
                <option value="found">Found</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information</label>
              <input
                type="text"
                value={formData.contact || ''}
                onChange={(e) => handleInputChange('contact', e.target.value)}
                placeholder="Email or phone number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                {editingItem ? 'Update' : 'Post'} Item
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'feedback':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              {editingItem ? 'Edit Feedback' : 'New Feedback'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <select
                value={formData.rating || '5'}
                onChange={(e) => handleInputChange('rating', parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1 Star</option>
                <option value={2}>2 Stars</option>
                <option value={3}>3 Stars</option>
                <option value={4}>4 Stars</option>
                <option value={5}>5 Stars</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingItem ? 'Update' : 'Submit'} Feedback
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Function to render an individual card based on the item and section
  const renderCard = (item) => {
    const getPriorityColor = (priority) => {
      switch (priority) {
        case 'high': return 'bg-red-100 text-red-800';
        case 'medium': return 'bg-yellow-100 text-yellow-800';
        case 'low': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getTypeColor = (type) => {
      return type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
    };

    return (
      <div key={item.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="text-blue-600 hover:text-blue-800 p-1 rounded"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-red-600 hover:text-red-800 p-1 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <p className="text-gray-600 mb-4">{item.content}</p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {activeSection === 'announcements' && item.priority && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
              {item.priority.toUpperCase()}
            </span>
          )}
          {activeSection === 'lostfound' && item.type && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
              {item.type.toUpperCase()}
            </span>
          )}
          {activeSection === 'feedback' && item.rating && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {'★'.repeat(item.rating)} ({item.rating}/5)
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-500 space-y-1">
          <div>Posted: {item.date}</div>
          {item.time && <div>Time: {item.time}</div>}
          {item.location && <div>Location: {item.location}</div>}
          {item.contact && <div>Contact: {item.contact}</div>}
          <div>By: {item.author}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Community Noticeboard</h1>
              <p className="text-sm text-gray-600">Stay connected with your community</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsAdmin(!isAdmin)}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  isAdmin 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isAdmin ? 'Exit Admin' : 'Admin Mode'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 sticky top-[100px] h-fit">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Sections</h2>
              <nav className="space-y-2">
                {[
                  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-5 h-5" /> },
                  { id: 'events', label: 'Events', icon: <Calendar className="w-5 h-5" /> },
                  { id: 'lostfound', label: 'Lost & Found', icon: <Search className="w-5 h-5" /> },
                  { id: 'feedback', label: 'Feedback', icon: <MessageCircle className="w-5 h-5" /> },
                ].map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      setShowForm(false);
                      setEditingItem(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-100 text-blue-800 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {section.icon}
                    {section.label}
                  </button>
                ))}
              </nav>
              <div className="mt-6 text-xs text-gray-500 p-2 border-t pt-4">
                <p className="font-semibold mb-1">User ID:</p>
                <p className="break-all">{userId || 'Authenticating...'}</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Section Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {getSectionIcon()}
                  <h2 className="text-2xl font-bold text-gray-800">{getSectionTitle()}</h2>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowForm(!showForm);
                      setEditingItem(null);
                      setFormData({});
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {showForm ? 'Cancel' : 'Add New'}
                  </button>
                )}
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-center items-center py-12 bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-4 text-lg text-gray-600">Loading posts...</span>
              </div>
            )}

            {/* Form */}
            {isAdmin && showForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                {renderForm()}
              </div>
            )}

            {/* Content Grid */}
            {!isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getCurrentData().length > 0 ? (
                  getCurrentData().map(renderCard)
                ) : (
                  <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-gray-400 mb-4 flex justify-center">{getSectionIcon()}</div>
                    <p className="text-gray-600">No {getSectionTitle().toLowerCase()} posted yet.</p>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowForm(true);
                          setEditingItem(null);
                          setFormData({});
                        }}
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add First {getSectionTitle().slice(0, -1)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityNoticeboard;

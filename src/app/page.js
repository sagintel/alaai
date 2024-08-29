'use client'

import React from 'react';
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [value, setValue] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const chatEndRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadingDots, setLoadingDots] = useState('');
  const [data, setData] = useState({});
  const sidebarRef = useRef(null);

  // Load workspaces and current workspace on component mount
  useEffect(() => {
    const savedWorkspaces = JSON.parse(localStorage.getItem('workspaces')) || [];
    setWorkspaces(savedWorkspaces);

    const lastWorkspaceId = localStorage.getItem('currentWorkspaceId');
    const lastWorkspace = savedWorkspaces.find(w => w.id.toString() === lastWorkspaceId);
    if (lastWorkspace) {
      setCurrentWorkspace(lastWorkspace);
      setChatHistory(lastWorkspace.history || []); // This line ensures the chat history is loaded
    }
  }, []);

  // Save workspaces to local storage whenever they change
  useEffect(() => {
    if (workspaces.length > 0) {
      localStorage.setItem('workspaces', JSON.stringify(workspaces));
    }
  }, [workspaces]);

  // Save current workspace ID whenever it changes
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem('currentWorkspaceId', currentWorkspace.id.toString());
    }
  }, [currentWorkspace]);

  // Get context from data
  const getContextFromData = () => {
    return `
      Instructions: ${data.instructions?.map((instruction, index) => `${index + 1}. ${Object.values(instruction)[0]}`).join(' | ') || 'N/A'}
    `;
  };

  const createNewWorkspace = (title = null) => {
    const newWorkspace = {
      id: Date.now(),
      name: title || `Workspace ${workspaces.length + 1}`,
      history: []
    };
    setWorkspaces(prevWorkspaces => {
      const updatedWorkspaces = [...prevWorkspaces, newWorkspace];
      localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
      return updatedWorkspaces;
    });
    setCurrentWorkspace(newWorkspace);
    setChatHistory([]);
    localStorage.setItem('currentWorkspaceId', newWorkspace.id.toString());
    return newWorkspace;
  };

  const getResponse = async () => {
    if (!value.trim()) {
      setError("Error! Please ask a question");
      return;
    }
    setError("");

    // Create a new workspace if there's no current workspace
    if (!currentWorkspace) {
      const newWorkspace = createNewWorkspace(value);
      setCurrentWorkspace(newWorkspace);
    }

    const isFirstMessage = chatHistory.length === 0;
    const context = getContextFromData(); // Get the context from the fetched data
    const systemInstruction = `Here is some context to help you: ${context}`;
    const userMessage = isFirstMessage ? systemInstruction + value : value;
    setValue(""); // Clear input field immediately
    setIsLoading(true);

    try {
      const newHistory = [
        ...chatHistory,
        { role: "user", parts: value }
      ];
      setChatHistory(newHistory);

      const options = {
        method: "POST",
        body: JSON.stringify({
          history: newHistory,
          message: userMessage,
          context: context // Include the context in the request
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Use the environment variable for the API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/gemini';

      const response = await fetch(apiUrl, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseData = await response.text();
      const updatedHistory = [
        ...newHistory,
        { role: "model", parts: responseData }
      ];
      setChatHistory(updatedHistory);

      // Update current workspace
      if (currentWorkspace) {
        const updatedWorkspace = {
          ...currentWorkspace, 
          history: updatedHistory,
          name: currentWorkspace.history.length === 0 ? value : currentWorkspace.name
        };
        setCurrentWorkspace(updatedWorkspace);
        setWorkspaces(prevWorkspaces => {
          const newWorkspaces = prevWorkspaces.map(w => 
            w.id === updatedWorkspace.id ? updatedWorkspace : w
          );
          localStorage.setItem('workspaces', JSON.stringify(newWorkspaces)); // Save updated workspaces to localStorage
          return newWorkspaces;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setError(`An error occurred: ${error.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const deleteWorkspace = (workspaceId) => {
    setWorkspaces(prevWorkspaces => {
      const updatedWorkspaces = prevWorkspaces.filter(w => w.id !== workspaceId);
      localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
      return updatedWorkspaces;
    });

    if (currentWorkspace && currentWorkspace.id === workspaceId) {
      const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId);
      if (remainingWorkspaces.length > 0) {
        const newCurrentWorkspace = remainingWorkspaces[0];
        setCurrentWorkspace(newCurrentWorkspace);
        setChatHistory(newCurrentWorkspace.history || []);
        localStorage.setItem('currentWorkspaceId', newCurrentWorkspace.id.toString());
      } else {
        setCurrentWorkspace(null);
        setChatHistory([]);
        localStorage.removeItem('currentWorkspaceId');
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingDots(dots => (dots.length >= 3 ? '' : dots + '.'));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const renderFormattedMessage = (message) => {
    const lines = message.split('\n');
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*.*?\*\*)/);
      return (
        <React.Fragment key={lineIndex}>
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
            } else if (part.trim().startsWith('*')) {
              return (
                <React.Fragment key={partIndex}>
                  <br />• {part.trim().slice(1).trim()}
                </React.Fragment>
              );
            } else {
              return <React.Fragment key={partIndex}>{part}</React.Fragment>;
            }
          })}
          <br />
        </React.Fragment>
      );
    });
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/getData');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex h-screen w-full bg-[#1e1e1e] text-white overflow-hidden">
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#161616] p-4 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
      >
        <button onClick={toggleSidebar} className="absolute top-4 right-4 text-white hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold mb-4 text-white">Workspaces</h1>
        <button onClick={() => createNewWorkspace()} className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white font-bold py-2 px-4 rounded-sm mb-2 flex items-center">
          <span className="mr-2">+</span>
          New workspace
        </button>
        <div className="flex-grow overflow-auto">
          {workspaces.map(workspace => (
            <div key={workspace.id} className="flex items-center mb-1">
              <button
                onClick={() => {
                  setCurrentWorkspace(workspace);
                  setChatHistory(workspace.history || []);
                }}
                className={`flex-grow text-left p-2 rounded-none ${
                  currentWorkspace?.id === workspace.id ? 'bg-[#4a4a4a]' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
                }`}
              >
                {workspace.name}
              </button>
              <button
                onClick={() => deleteWorkspace(workspace.id)}
                className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white p-2 rounded-none"
                title="Delete workspace"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        {/* ... other sidebar buttons ... */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
        {/* Sidebar toggle button - Remove md:hidden class */}
        <button onClick={toggleSidebar} className="absolute top-4 left-4 z-20 bg-[#3a3a3a] p-2 rounded-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <main className="flex-grow overflow-auto p-4 pt-16">
          <div className="max-w-3xl mx-auto space-y-4">
            {chatHistory.length > 0 ? (
              <>
                {chatHistory.map((chatItem, index) => (
                  <div key={index} className={`flex ${chatItem.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-sm ${
                      chatItem.role === 'user' ? 'bg-[#3a3a3a] text-white' : 'bg-[#2b2b2b] text-white'
                    }`}>
                      {renderFormattedMessage(chatItem.parts)}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#2b2b2b] text-white p-3 rounded-sm">
                      AI is thinking{loadingDots}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center p-4 text-center h-full">
                <p className="text-4xl font-bold text-gray-300">Welcome</p>
              </div>
            )}
          </div>
        </main>
        <footer className="bg-[#1e1e1e] p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={(e) => { e.preventDefault(); getResponse(); }} className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-grow p-3 bg-[#2b2b2b] text-white border border-[#3a3a3a] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#4a4a4a]"
                placeholder="Type your message..."
                id="message-input"
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white font-semibold p-3 rounded-sm transition duration-300 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </footer>
      </div>
    </div>
  );
}

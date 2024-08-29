'use client'

import React from 'react';
import { useState, useRef, useEffect, useCallback } from "react";
import { FaPencilAlt, FaHeading, FaListUl, FaQuoteRight, FaBolt, FaBullhorn, FaHashtag, FaUserAstronaut, FaGlobe, FaPaperPlane, FaLanguage, FaBars, FaChevronLeft, FaTimes } from 'react-icons/fa';

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
  const [showPromptBoxes, setShowPromptBoxes] = useState(true);
  const [language, setLanguage] = useState('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

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
    let truncatedTitle = title;
    if (title) {
      const words = title.split(' ');
      truncatedTitle = words.slice(0, 4).join(' ');
      if (words.length > 4) {
        truncatedTitle += '...';
      }
    }

    const newWorkspace = {
      id: Date.now(),
      name: truncatedTitle || `Workspace ${workspaces.length + 1}`,
      history: []
    };
    setWorkspaces(prevWorkspaces => {
      const updatedWorkspaces = [...prevWorkspaces, newWorkspace];
      localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
      return updatedWorkspaces;
    });
    setCurrentWorkspace(newWorkspace);
    setChatHistory([]);
    setShowPromptBoxes(true); // Reset showPromptBoxes to true
    localStorage.setItem('currentWorkspaceId', newWorkspace.id.toString());
    return newWorkspace;
  };

  const translateMessage = async (message, targetLang) => {
    // This is a placeholder. You should implement actual translation logic here.
    // For now, we'll just return the original message.
    return message;
  };

  const getResponse = async (message = value) => {
    if (!message.trim()) {
      setError(t("askQuestion"));
      return;
    }
    setError("");
    setShowPromptBoxes(false); // Hide prompt boxes when sending a message

    // Create a new workspace if there's no current workspace
    if (!currentWorkspace) {
      const newWorkspace = createNewWorkspace(message);
      setCurrentWorkspace(newWorkspace);
    }

    const isFirstMessage = chatHistory.length === 0;
    const context = getContextFromData(); // Get the context from the fetched data
    const systemInstruction = `Here is some context to help you: ${context}`;
    const userMessage = isFirstMessage ? systemInstruction + message : message;
    setValue(""); // Clear input field immediately
    setIsLoading(true);

    try {
      const newHistory = [
        ...chatHistory,
        { role: "user", parts: message }
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
      
      const apiUrl = '/api/gemini'; // Use the local API route

      const response = await fetch(apiUrl, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const responseData = await response.json();
      let translatedResponse = responseData.text;
      
      if (language === 'ar') {
        translatedResponse = await translateMessage(responseData.text, 'ar');
      }

      const updatedHistory = [
        ...newHistory,
        { role: "model", parts: translatedResponse }
      ];
      setChatHistory(updatedHistory);

      // Update current workspace
      if (currentWorkspace) {
        let truncatedName = message;
        const words = message.split(' ');
        if (words.length > 4) {
          truncatedName = words.slice(0, 4).join(' ') + '...';
        }
        const updatedWorkspace = {
          ...currentWorkspace, 
          history: updatedHistory,
          name: currentWorkspace.history.length === 0 ? truncatedName : currentWorkspace.name
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
      setError(t("error"));
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
        React.createElement(React.Fragment, { key: lineIndex },
          parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return React.createElement('strong', { key: partIndex }, part.slice(2, -2));
            } else if (part.trim().startsWith('*')) {
              return (
                React.createElement(React.Fragment, { key: partIndex }, [
                  React.createElement('br', { key: 'br' }),
                  `• ${part.trim().slice(1).trim()}`
                ])
              );
            } else {
              return React.createElement(React.Fragment, { key: partIndex }, part);
            }
          }),
          React.createElement('br', { key: 'lineBreak' })
        )
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

  const promptBoxes = [
    { icon: <FaBolt />, text: "craftViralHook" },
    { icon: <FaBullhorn />, text: "createPersuasiveAdCopy" },
    { icon: <FaHashtag />, text: "generateTrendingHashtags" },
    { icon: <FaUserAstronaut />, text: "developBrandPersona" },
  ];

  const detailedPrompts = {
    en: {
      craftViralHook: "You are a social media expert, and I need your help crafting a viral hook for my product. Create an attention-grabbing opening line or concept that will make people want to learn more and share with others.",
      createPersuasiveAdCopy: "You are a copywriting genius, and I need your help creating persuasive ad copy. Write a compelling advertisement that highlights the key benefits of my product and convinces the reader to take action.",
      generateTrendingHashtags: "You are a social media trend analyst, and I need your help generating trending hashtags. Create a list of 5-10 potential hashtags that could go viral and increase visibility for my brand or campaign.",
      developBrandPersona: "You are a brand strategist, and I need your help developing a brand persona. Create a detailed description of my brand's personality, voice, and values as if it were a real person. Include traits that will resonate with my target audience."
    },
    ar: {
      craftViralHook: "أنت خبير في وسائل التواصل الاجتماعي. ساعدني في صياغة عنوان جذاب لمنتجي. ابتكر جملة افتتاحية أو فكرة تلفت الانتباه وتحفز الناس على معرفة المزيد ومشاركتها مع الآخرين.",
      createPersuasiveAdCopy: "أنت خبير في كتابة النصوص الإعلانية. ساعدني في إنشاء نص إعلاني مقنع. اكتب إعلانًا مؤثرًا يبرز المزايا الرئيسية لمنتجي ويحث القارئ على اتخاذ إجراء.",
      generateTrendingHashtags: "أنت محلل لاتجاهات وسائل التواصل الاجتماعي. ساعدني في إنشاء هاشتاغات رائجة. قم بإنشاء قائمة من 5-10 هاشتاغات محتملة يمكن أن تنتشر بسرعة وتزيد من ظهور علامتي التجارية أو حملتي.",
      developBrandPersona: "أنت خبير في استراتيجيات العلامات التجارية. ساعدني في تطوير شخصية للعلامة التجارية. قم بإنشاء وصف مفصل لشخصية علامتي التجارية وصوتها وقيمها كما لو كانت شخصًا حقيقيًا. أضف سمات ستجذب جمهوري المستهدف."
    }
  };

  const handlePromptClick = (promptKey) => {
    const detailedPrompt = detailedPrompts[language][promptKey] || t(promptKey);
    setValue(detailedPrompt);
    getResponse(detailedPrompt);
    setShowPromptBoxes(false);
  };

  const handleLanguageSelect = (lang) => {
    setLanguage(lang);
    setShowLanguageDropdown(false);
  };

  const translations = {
    en: {
      newWorkspace: "New workspace",
      workspaces: "Workspaces",
      welcome: "Welcome to Kyro",
      typeMessage: "Type your message...",
      send: "Send",
      rights: "All rights reserved.",
      followMe: "Follow me on Instagram:",
      craftViralHook: "Craft a viral hook",
      createPersuasiveAdCopy: "Create persuasive ad copy",
      generateTrendingHashtags: "Generate trending hashtags",
      developBrandPersona: "Develop brand persona",
      thinking: "Thinking",
      error: "An error occurred. Please try again.",
      askQuestion: "Error! Please ask a question"
    },
    ar: {
      newWorkspace: "مساحة عمل جديدة",
      workspaces: "مساحات العمل",
      welcome: "مرحبًا بك في كايرو",
      typeMessage: "اكتب رسالتك...",
      send: "إرسال",
      rights: "جميع الحقوق محفوظة.",
      followMe: "تابعني على انستغرام:",
      craftViralHook: "صياغة عنوان جذاب",
      createPersuasiveAdCopy: "إنشاء نص إعلاني مقنع",
      generateTrendingHashtags: "إنشاء هاشتاغات رائجة",
      developBrandPersona: "تطوير شخصية العلامة التجارية",
      thinking: "جاري التفكير",
      error: "حدث خطأ! يرجى المحاولة مرة أخرى.",
      askQuestion: "خطأ! يرجى طرح سؤال"
    }
  };

  const t = (key) => translations[language][key] || key;

  const renderPromptBoxes = () => {
    if (!showPromptBoxes) return null;

    return React.createElement('div', { className: "grid grid-cols-2 gap-4 mb-8 max-w-lg mx-auto" },
      promptBoxes.map((box, index) => 
        React.createElement('button', {
          key: index,
          onClick: () => handlePromptClick(box.text),
          className: "bg-[#161616] hover:bg-[#2b2b2b] text-white p-3 rounded-lg flex flex-col items-center justify-center transition duration-300 h-24"
        }, [
          React.createElement('div', { className: "text-xl mb-2", key: 'icon' }, box.icon),
          React.createElement('p', { className: "text-xs text-center", key: 'text' }, t(box.text))
        ])
      )
    );
  };

  const renderChatHistory = () => {
    return React.createElement('div', { className: "space-y-4" },
      chatHistory.map((chatItem, index) => 
        React.createElement('div', {
          key: index,
          className: `flex ${chatItem.role === 'user' ? 'justify-end' : 'justify-start'}`
        },
          React.createElement('div', {
            className: `max-w-[70%] p-3 rounded-sm ${
              chatItem.role === 'user' ? 'bg-[#3a3a3a] text-white' : 'bg-[#2b2b2b] text-white'
            }`
          }, renderFormattedMessage(chatItem.parts))
        )
      ),
      isLoading && React.createElement('div', { className: "flex justify-start" },
        React.createElement('div', { className: "bg-[#2b2b2b] text-white p-3 rounded-sm" },
          `${t('thinking')}${loadingDots}`
        )
      ),
      React.createElement('div', { ref: chatEndRef })
    );
  };

  const renderForm = () => {
    return React.createElement('form', {
      onSubmit: (e) => { e.preventDefault(); getResponse(); },
      className: "flex items-center gap-2"
    }, [
      React.createElement('input', {
        value: value,
        onChange: (e) => setValue(e.target.value),
        className: "flex-grow p-3 bg-[#2b2b2b] text-white border border-[#3a3a3a] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#4a4a4a]",
        placeholder: t('typeMessage'),
        id: "message-input",
        key: 'input'
      }),
      React.createElement('button', {
        type: "submit",
        disabled: isLoading,
        className: "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white font-semibold p-3 rounded-sm transition duration-300 disabled:opacity-50",
        key: 'button'
      }, React.createElement(FaPaperPlane, { className: "w-6 h-6" }))
    ]);
  };

  const renderSidebar = () => {
    return React.createElement('div', {
      ref: sidebarRef,
      className: `fixed inset-y-0 left-0 z-30 w-64 bg-[#161616] p-4 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`
    }, [
      React.createElement('button', {
        onClick: toggleSidebar,
        className: "absolute top-4 right-4 text-white hover:text-gray-300"
      }, React.createElement(FaChevronLeft, { className: "h-6 w-6" })),
      React.createElement('h1', { className: "text-lg font-semibold mb-4 text-white" }, t('workspaces')),
      React.createElement('button', {
        onClick: () => createNewWorkspace(),
        className: "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white font-bold py-2 px-4 rounded-sm mb-2 flex items-center"
      }, [
        React.createElement('span', { className: "mr-2" }, "+"),
        t('newWorkspace')
      ]),
      React.createElement('div', { className: "flex-grow overflow-auto" },
        workspaces.map(workspace => 
          React.createElement('div', { key: workspace.id, className: "flex items-center mb-1" }, [
            React.createElement('button', {
              onClick: () => {
                setCurrentWorkspace(workspace);
                setChatHistory(workspace.history || []);
                setShowPromptBoxes(workspace.history.length === 0);
              },
              className: `flex-grow text-left p-2 rounded-none ${
                currentWorkspace?.id === workspace.id ? 'bg-[#4a4a4a]' : 'bg-[#3a3a3a] hover:bg-[#4a4a4a]'
              }`
            }, workspace.name),
            React.createElement('button', {
              onClick: () => deleteWorkspace(workspace.id),
              className: "bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white p-2 rounded-none",
              title: "Delete workspace"
            }, "X")
          ])
        )
      )
    ]);
  };

  return React.createElement('div', {
    className: `flex h-screen w-full bg-[#1e1e1e] text-white overflow-hidden ${language === 'ar' ? 'font-arabic' : ''}`
  }, [
    renderSidebar(),
    // Language toggle button
    React.createElement('button', {
      onClick: () => setShowLanguageDropdown(!showLanguageDropdown),
      className: "absolute top-4 right-4 z-30 bg-[#3a3a3a] p-2 rounded-sm",
      key: 'langToggle'
    }, React.createElement(FaLanguage, { className: "w-6 h-6" })),
    showLanguageDropdown && React.createElement('div', {
      className: "absolute top-16 right-4 mt-2 py-2 w-48 bg-[#2b2b2b] rounded-sm shadow-xl z-20"
    }, [
      React.createElement('button', {
        className: "block px-4 py-2 text-sm capitalize text-white hover:bg-[#3a3a3a] w-full text-left",
        onClick: () => handleLanguageSelect('en'),
        key: 'en'
      }, "English"),
      React.createElement('button', {
        className: "block px-4 py-2 text-sm capitalize text-white hover:bg-[#3a3a3a] w-full text-left",
        onClick: () => handleLanguageSelect('ar'),
        key: 'ar'
      }, "العربية")
    ]),

    // Main content
    React.createElement('div', { className: "flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]", key: 'mainContent' }, [
      // Sidebar toggle button
      React.createElement('button', {
        onClick: toggleSidebar,
        className: "absolute top-4 left-4 z-20 bg-[#3a3a3a] p-2 rounded-sm",
        key: 'sidebarToggle'
      }, React.createElement(FaBars, { className: "w-6 h-6" })),

      // Main content area
      React.createElement('main', { className: "flex-grow overflow-auto p-4 pt-16", key: 'main' },
        React.createElement('div', { className: "max-w-3xl mx-auto space-y-4" }, [
          React.createElement('div', { className: "mb-8", key: 'welcome' },
            React.createElement('p', { className: "text-4xl font-bold text-gray-300 text-center" }, t('welcome'))
          ),
          renderPromptBoxes(),
          renderChatHistory()
        ])
      ),

      // Footer
      React.createElement('footer', { className: "bg-[#1e1e1e] p-4", key: 'footer' },
        React.createElement('div', { className: "max-w-3xl mx-auto" }, [
          renderForm(),
          error && React.createElement('p', { className: "text-red-500 mt-2", key: 'error' }, t(error)),
          React.createElement('div', { className: "mt-4 text-center text-sm text-gray-400", key: 'footerText' }, [
            React.createElement('p', { key: 'rights' }, `© 2024 ${t('rights')}`),
            React.createElement('p', { key: 'followMe' }, [
              `${t('followMe')} `,
              React.createElement('a', {
                href: "https://www.instagram.com/alaalkalai",
                target: "_blank",
                rel: "noopener noreferrer",
                className: "text-blue-400 hover:underline"
              }, "@alaalkalai")
            ])
          ])
        ])
      )
    ])
  ]);
}

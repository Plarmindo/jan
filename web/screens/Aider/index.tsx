'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button, Input, ScrollArea } from '@janhq/joi'
import {
  FolderIcon,
  PlayIcon,
  SquareIcon,
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
  SearchIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface AiderFile {
  path: string
  name: string
  size: number
  modified: string
}

interface AiderMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface AiderSession {
  id: string
  status: 'idle' | 'running' | 'error'
  files: AiderFile[]
  messages: AiderMessage[]
  currentDirectory: string
}

const AiderScreen: React.FC = () => {
  const [session, setSession] = useState<AiderSession>({
    id: '',
    status: 'idle',
    files: [],
    messages: [],
    currentDirectory: ''
  })

  const [activeTab, setActiveTab] = useState<'files' | 'chat' | 'settings'>('files')
  const [projectPath, setProjectPath] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Bridge server communication
  const BRIDGE_URL = 'http://localhost:8765'

  useEffect(() => {
    loadAiderStatus()
    loadAiderSettings()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [session.messages])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadAiderStatus = async () => {
    try {
      const response = await fetch(`${BRIDGE_URL}/aider/status`)
      if (response.ok) {
        const data = await response.json()
        setSession(prev => ({
          ...prev,
          status: data.status,
          currentDirectory: data.current_directory || ''
        }))
      }
    } catch (error) {
      console.error('Failed to load Aider status:', error)
    }
  }

  const loadAiderSettings = async () => {
    try {
      const response = await fetch(`${BRIDGE_URL}/aider/settings`)
      if (response.ok) {
        const data = await response.json()
        setProjectPath(data.default_directory || '')
      }
    } catch (error) {
      console.error('Failed to load Aider settings:', error)
    }
  }

  const startAiderSession = async () => {
    if (!projectPath) {
      alert('Please select a project directory first')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${BRIDGE_URL}/aider/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: projectPath })
      })

      if (response.ok) {
        const data = await response.json()
        setSession(prev => ({
          ...prev,
          id: data.session_id,
          status: 'running',
          currentDirectory: projectPath
        }))
        loadProjectFiles()
      } else {
        const error = await response.json()
        alert(`Failed to start Aider: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to start Aider session:', error)
      alert('Failed to connect to Aider bridge server')
    } finally {
      setIsLoading(false)
    }
  }

  const stopAiderSession = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${BRIDGE_URL}/aider/stop`, {
        method: 'POST'
      })

      if (response.ok) {
        setSession(prev => ({
          ...prev,
          id: '',
          status: 'idle',
          files: [],
          messages: []
        }))
      }
    } catch (error) {
      console.error('Failed to stop Aider session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadProjectFiles = async () => {
    try {
      const response = await fetch(`${BRIDGE_URL}/aider/files`)
      if (response.ok) {
        const data = await response.json()
        setSession(prev => ({
          ...prev,
          files: data.files || []
        }))
      }
    } catch (error) {
      console.error('Failed to load project files:', error)
    }
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || session.status !== 'running') return

    const userMessage: AiderMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    }

    setSession(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }))

    setChatInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${BRIDGE_URL}/aider/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: AiderMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        }

        setSession(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage]
        }))

        // Refresh files in case they were modified
        loadProjectFiles()
      } else {
        const error = await response.json()
        const errorMessage: AiderMessage = {
          role: 'system',
          content: `Error: ${error.error}`,
          timestamp: new Date().toISOString()
        }

        setSession(prev => ({
          ...prev,
          messages: [...prev.messages, errorMessage]
        }))
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: AiderMessage = {
        role: 'system',
        content: 'Failed to communicate with Aider',
        timestamp: new Date().toISOString()
      }

      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage]
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const browseProjectDirectory = async () => {
    // This would typically open a directory picker
    // For now, we'll use a simple prompt
    const path = prompt('Enter project directory path:', projectPath)
    if (path) {
      setProjectPath(path)
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'files':
        return (
          <div className="flex-1 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={browseProjectDirectory}
                className="flex items-center gap-2"
              >
                <FolderIcon size={16} />
                Browse
              </Button>
              <Input
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Project directory path..."
                className="flex-1"
              />
            </div>

            {session.files.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  {session.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded hover:bg-[hsla(var(--dropdown-menu-item-hover-bg))]"
                    >
                      <FileTextIcon size={16} className="text-[hsla(var(--text-secondary))]" />
                      <span className="flex-1 text-sm">{file.name}</span>
                      <span className="text-xs text-[hsla(var(--text-secondary))]">
                        {(file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[hsla(var(--text-secondary))]">
                {session.status === 'running' ? 'No files in project' : 'Start a session to view files'}
              </div>
            )}
          </div>
        )

      case 'chat':
        return (
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {session.messages.map((message, index) => (
                  <div
                    key={index}
                    className={twMerge(
                      'p-3 rounded-lg max-w-[80%]',
                      message.role === 'user' && 'bg-[hsla(var(--primary-bg))] text-[hsla(var(--primary-fg))] ml-auto',
                      message.role === 'assistant' && 'bg-[hsla(var(--secondary-bg))]',
                      message.role === 'system' && 'bg-[hsla(var(--destructive-bg))] text-[hsla(var(--destructive-fg))]'
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs text-[hsla(var(--text-secondary))] mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {session.status === 'running' && (
              <div className="p-4 border-t border-[hsla(var(--app-border))]">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Aider to help with your code..."
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || isLoading}
                    size="sm"
                  >
                    <MessageSquareIcon size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )

      case 'settings':
        return (
          <div className="flex-1 p-4">
            <h3 className="text-lg font-semibold mb-4">Aider Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Default Project Directory</label>
                <div className="flex gap-2">
                  <Input
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    placeholder="Select default directory..."
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={browseProjectDirectory}>
                    Browse
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-[hsla(var(--app-border))]">
                <p className="text-sm text-[hsla(var(--text-secondary))]">
                  Additional Aider settings can be configured through Jan's main Settings panel.
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-[hsla(var(--app-bg))]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[hsla(var(--app-border))]">
        <h2 className="text-xl font-semibold">Aider - AI Pair Programming</h2>
        <div className="flex items-center gap-2">
          {session.status === 'idle' ? (
            <Button
              onClick={startAiderSession}
              disabled={isLoading || !projectPath}
              className="flex items-center gap-2"
            >
              <PlayIcon size={16} />
              Start Session
            </Button>
          ) : (
            <Button
              onClick={stopAiderSession}
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <SquareIcon size={16} />
              Stop Session
            </Button>
          )}

          <div className={twMerge(
            'px-2 py-1 rounded text-xs font-medium',
            session.status === 'idle' && 'bg-[hsla(var(--secondary-bg))] text-[hsla(var(--secondary-fg))]',
            session.status === 'running' && 'bg-[hsla(var(--success-bg))] text-[hsla(var(--success-fg))]',
            session.status === 'error' && 'bg-[hsla(var(--destructive-bg))] text-[hsla(var(--destructive-fg))]'
          )}>
            {session.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsla(var(--app-border))]">
        {[
          { id: 'files', label: 'Files', icon: FolderIcon },
          { id: 'chat', label: 'Chat', icon: MessageSquareIcon },
          { id: 'settings', label: 'Settings', icon: SettingsIcon }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={twMerge(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-[hsla(var(--primary-bg))] text-[hsla(var(--primary-fg))]'
                : 'border-transparent text-[hsla(var(--text-secondary))] hover:text-[hsla(var(--text-primary))]'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {renderTabContent()}
    </div>
  )
}

export default AiderScreen

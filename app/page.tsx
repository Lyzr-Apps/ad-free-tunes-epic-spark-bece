'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent, AIAgentResponse } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { cn, generateUUID } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RiMusic2Fill, RiPlayListFill, RiPlayListAddFill } from 'react-icons/ri'
import { IoSend, IoMusicalNotes, IoAdd } from 'react-icons/io5'
import { FiExternalLink, FiMenu, FiPlus, FiTrash2 } from 'react-icons/fi'
import { BsMusicNoteBeamed } from 'react-icons/bs'
import { HiOutlineMusicNote } from 'react-icons/hi'

// --- Interfaces ---

interface Track {
  title: string
  artist: string
  genre: string
  source: string
  url: string
  description: string
}

interface PlaylistAction {
  action: 'create' | 'add' | 'remove' | 'rename' | 'list'
  playlist_name: string
  track_indices: number[]
}

interface AgentParsedResponse {
  message: string
  tracks: Track[]
  playlist_action: PlaylistAction | null
}

interface Playlist {
  id: string
  name: string
  tracks: Track[]
  createdAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tracks?: Track[]
  playlistAction?: PlaylistAction | null
  timestamp: string
}

// --- Constants ---

const AGENT_ID = '699ec84763b93379f288d38e'
const STORAGE_KEY_PLAYLISTS = 'musicmate_playlists'
const STORAGE_KEY_MESSAGES = 'musicmate_messages'
const STORAGE_KEY_SESSION = 'musicmate_session'

// --- Sample Data ---

const SAMPLE_TRACKS: Track[] = [
  {
    title: 'Celestial Drift',
    artist: 'Luna Wave',
    genre: 'Ambient',
    source: 'Free Music Archive',
    url: 'https://freemusicarchive.org/example1',
    description: 'Ethereal ambient soundscape perfect for late-night study sessions.',
  },
  {
    title: 'Neon Boulevard',
    artist: 'Retro Synth Collective',
    genre: 'Synthwave',
    source: 'Jamendo',
    url: 'https://jamendo.com/example2',
    description: 'Pulsating synthwave with 80s vibes and driving basslines.',
  },
  {
    title: 'Morning Bloom',
    artist: 'Acoustic Garden',
    genre: 'Folk',
    source: 'Creative Commons',
    url: 'https://creativecommons.org/example3',
    description: 'Warm acoustic folk guitar with gentle fingerpicking patterns.',
  },
  {
    title: 'Deep Current',
    artist: 'Bass Theory',
    genre: 'Lo-fi Hip Hop',
    source: 'Free Music Archive',
    url: 'https://freemusicarchive.org/example4',
    description: 'Chill lo-fi beats with jazzy samples, ideal for relaxing.',
  },
  {
    title: 'Electric Pulse',
    artist: 'Circuit Breaker',
    genre: 'Electronic',
    source: 'Jamendo',
    url: 'https://jamendo.com/example5',
    description: 'High-energy electronic track with complex layered synths.',
  },
]

const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 'sample-1',
    role: 'user',
    content: 'I\'m looking for some chill ambient music for studying late at night. Something atmospheric and relaxing.',
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'sample-2',
    role: 'assistant',
    content: 'Great taste! I found some amazing free ambient and chill tracks that are perfect for late-night study sessions. These range from ethereal soundscapes to lo-fi beats -- all legally free to listen to.',
    tracks: SAMPLE_TRACKS.slice(0, 3),
    timestamp: new Date(Date.now() - 290000).toISOString(),
  },
  {
    id: 'sample-3',
    role: 'user',
    content: 'These are awesome! Can you find some more upbeat electronic tracks too?',
    timestamp: new Date(Date.now() - 200000).toISOString(),
  },
  {
    id: 'sample-4',
    role: 'assistant',
    content: 'Absolutely! Here are some energetic electronic and synthwave tracks to get you moving. These are all available for free streaming.',
    tracks: SAMPLE_TRACKS.slice(3),
    timestamp: new Date(Date.now() - 190000).toISOString(),
  },
]

const SAMPLE_PLAYLISTS: Playlist[] = [
  {
    id: 'sample-pl-1',
    name: 'Late Night Study',
    tracks: SAMPLE_TRACKS.slice(0, 2),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sample-pl-2',
    name: 'Energy Boost',
    tracks: SAMPLE_TRACKS.slice(3),
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
]

// --- Markdown Renderer ---

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// --- Error Boundary ---

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Track Card Component ---

function TrackCard({
  track,
  playlists,
  onAddToPlaylist,
}: {
  track: Track
  playlists: Playlist[]
  onAddToPlaylist: (playlistId: string, track: Track) => void
}) {
  return (
    <Card className="bg-secondary/50 border-border/50 hover:bg-secondary/80 transition-colors duration-200">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mt-0.5">
            <BsMusicNoteBeamed className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm text-foreground truncate">
                  {track?.title ?? 'Unknown Track'}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {track?.artist ?? 'Unknown Artist'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {playlists.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-accent">
                        <IoAdd className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      {playlists.map((pl) => (
                        <DropdownMenuItem
                          key={pl.id}
                          onClick={() => onAddToPlaylist(pl.id, track)}
                          className="text-xs cursor-pointer"
                        >
                          <RiPlayListAddFill className="w-3.5 h-3.5 mr-2 text-accent" />
                          {pl.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {track?.url && (
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                  >
                    Listen Free
                    <FiExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {track?.genre && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/15 text-accent border-accent/20">
                  {track.genre}
                </Badge>
              )}
              {track?.source && (
                <span className="text-[10px] text-muted-foreground">{track.source}</span>
              )}
            </div>
            {track?.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {track.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Typing Indicator ---

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
        <IoMusicalNotes className="w-4 h-4 text-accent" />
      </div>
      <div className="flex items-center gap-1 bg-secondary/60 rounded-2xl px-4 py-2.5">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// --- Playlist Sidebar Content ---

function PlaylistSidebarContent({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
}: {
  playlists: Playlist[]
  selectedPlaylistId: string | null
  onSelectPlaylist: (id: string | null) => void
  onCreatePlaylist: () => void
  onDeletePlaylist: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RiPlayListFill className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-sm tracking-tight">Playlists</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-accent"
            onClick={onCreatePlaylist}
          >
            <FiPlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Separator className="bg-border/50" />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {playlists.length === 0 && (
            <div className="text-center py-8 px-4">
              <HiOutlineMusicNote className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No playlists yet.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Create one to save tracks.</p>
            </div>
          )}
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group',
                selectedPlaylistId === pl.id
                  ? 'bg-accent/15 text-accent'
                  : 'hover:bg-secondary/80 text-foreground'
              )}
              onClick={() => onSelectPlaylist(selectedPlaylistId === pl.id ? null : pl.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <IoMusicalNotes className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="text-sm truncate">{pl.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                  {pl.tracks.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePlaylist(pl.id)
                  }}
                >
                  <FiTrash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// --- Agent Info ---

function AgentInfoSection({ isActive }: { isActive: boolean }) {
  return (
    <div className="p-3 border-t border-border/50">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40')} />
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground truncate">Music Discovery Agent</p>
          <p className="text-[9px] text-muted-foreground/60 truncate">Perplexity sonar-pro / Web Search</p>
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function Page() {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [sampleMode, setSampleMode] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize session and load from localStorage
  useEffect(() => {
    const storedSession = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SESSION) : null
    if (storedSession) {
      setSessionId(storedSession)
    } else {
      const newSession = generateUUID()
      setSessionId(newSession)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SESSION, newSession)
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const storedPlaylists = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
        if (storedPlaylists) {
          const parsed = JSON.parse(storedPlaylists)
          if (Array.isArray(parsed)) {
            setPlaylists(parsed)
          }
        }
      } catch {
        // ignore
      }

      try {
        const storedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES)
        if (storedMessages) {
          const parsed = JSON.parse(storedMessages)
          if (Array.isArray(parsed)) {
            setMessages(parsed)
          }
        }
      } catch {
        // ignore
      }
    }
  }, [])

  // Save playlists to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !sampleMode) {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists))
    }
  }, [playlists, sampleMode])

  // Save messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !sampleMode) {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages))
    }
  }, [messages, sampleMode])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Show notification helper
  const showNotification = useCallback((msg: string) => {
    setNotification(msg)
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null)
    }, 3000)
  }, [])

  // Last tracks from agent response (for playlist actions by index)
  const lastTracksRef = useRef<Track[]>([])

  // Playlist operations
  const handleCreatePlaylist = useCallback(() => {
    const name = prompt('Enter playlist name:')
    if (!name?.trim()) return
    const newPlaylist: Playlist = {
      id: generateUUID(),
      name: name.trim(),
      tracks: [],
      createdAt: new Date().toISOString(),
    }
    setPlaylists((prev) => [...prev, newPlaylist])
    showNotification(`Playlist "${name.trim()}" created`)
  }, [showNotification])

  const handleDeletePlaylist = useCallback(
    (id: string) => {
      setPlaylists((prev) => prev.filter((pl) => pl.id !== id))
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null)
      }
      showNotification('Playlist deleted')
    },
    [selectedPlaylistId, showNotification]
  )

  const handleAddToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId) {
            const alreadyExists = pl.tracks.some(
              (t) => t.title === track.title && t.artist === track.artist
            )
            if (alreadyExists) {
              showNotification(`Track already in "${pl.name}"`)
              return pl
            }
            showNotification(`Added to "${pl.name}"`)
            return { ...pl, tracks: [...pl.tracks, track] }
          }
          return pl
        })
      )
    },
    [showNotification]
  )

  const handleRemoveFromPlaylist = useCallback(
    (playlistId: string, trackIndex: number) => {
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId) {
            const newTracks = [...pl.tracks]
            newTracks.splice(trackIndex, 1)
            return { ...pl, tracks: newTracks }
          }
          return pl
        })
      )
      showNotification('Track removed from playlist')
    },
    [showNotification]
  )

  // Process playlist actions from agent
  const processPlaylistAction = useCallback(
    (action: PlaylistAction | null, tracks: Track[]) => {
      if (!action || !action.action) return

      const actionType = action.action
      const playlistName = action.playlist_name ?? ''
      const trackIndices = Array.isArray(action.track_indices) ? action.track_indices : []

      if (actionType === 'create' && playlistName) {
        const newPlaylist: Playlist = {
          id: generateUUID(),
          name: playlistName,
          tracks: [],
          createdAt: new Date().toISOString(),
        }
        if (trackIndices.length > 0 && tracks.length > 0) {
          trackIndices.forEach((idx) => {
            const track = tracks[idx - 1]
            if (track) {
              newPlaylist.tracks.push(track)
            }
          })
        }
        setPlaylists((prev) => [...prev, newPlaylist])
        showNotification(`Playlist "${playlistName}" created`)
      } else if (actionType === 'add' && playlistName) {
        setPlaylists((prev) =>
          prev.map((pl) => {
            if (pl.name.toLowerCase() === playlistName.toLowerCase()) {
              const newTracks = [...pl.tracks]
              const sourceList = tracks.length > 0 ? tracks : lastTracksRef.current
              trackIndices.forEach((idx) => {
                const track = sourceList[idx - 1]
                if (track && !newTracks.some((t) => t.title === track.title && t.artist === track.artist)) {
                  newTracks.push(track)
                }
              })
              return { ...pl, tracks: newTracks }
            }
            return pl
          })
        )
        showNotification(`Tracks added to "${playlistName}"`)
      } else if (actionType === 'remove' && playlistName) {
        setPlaylists((prev) =>
          prev.map((pl) => {
            if (pl.name.toLowerCase() === playlistName.toLowerCase()) {
              const newTracks = pl.tracks.filter((_, i) => !trackIndices.includes(i + 1))
              return { ...pl, tracks: newTracks }
            }
            return pl
          })
        )
        showNotification(`Tracks removed from "${playlistName}"`)
      } else if (actionType === 'rename' && playlistName) {
        // For rename, we'd need a new name -- for now just log
        showNotification(`Playlist renamed`)
      }
    },
    [showNotification]
  )

  // Send message
  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || loading) return

    setErrorMessage(null)

    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setLoading(true)
    setActiveAgentId(AGENT_ID)

    try {
      const result: AIAgentResponse = await callAIAgent(trimmed, AGENT_ID, {
        session_id: sessionId,
      })

      if (result.success) {
        const rawResult = result?.response?.result
        const parsed = parseLLMJson(rawResult)

        const agentMessage: string =
          parsed?.message ||
          result?.response?.message ||
          (typeof rawResult === 'string' ? rawResult : '') ||
          'Here are my recommendations.'

        const tracks: Track[] = Array.isArray(parsed?.tracks) ? parsed.tracks : []
        const playlistAction: PlaylistAction | null = parsed?.playlist_action ?? null

        if (tracks.length > 0) {
          lastTracksRef.current = tracks
        }

        const assistantMessage: ChatMessage = {
          id: generateUUID(),
          role: 'assistant',
          content: agentMessage,
          tracks: tracks.length > 0 ? tracks : undefined,
          playlistAction: playlistAction,
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        processPlaylistAction(playlistAction, tracks)
      } else {
        const errorText = result?.error || result?.response?.message || 'Something went wrong. Please try again.'
        setErrorMessage(errorText)
        const errorMsg: ChatMessage = {
          id: generateUUID(),
          role: 'assistant',
          content: 'I had trouble processing that request. Please try again.',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: 'A network error occurred. Please check your connection and try again.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [inputValue, loading, sessionId, processPlaylistAction])

  // Handle key down on input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Determine which data to show
  const displayMessages = sampleMode ? SAMPLE_MESSAGES : messages
  const displayPlaylists = sampleMode ? SAMPLE_PLAYLISTS : playlists

  // Selected playlist details
  const selectedPlaylist = displayPlaylists.find((pl) => pl.id === selectedPlaylistId) ?? null

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Notification */}
        {notification && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-accent text-accent-foreground rounded-lg shadow-lg shadow-accent/20 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
            {notification}
          </div>
        )}

        {/* Mobile Sidebar (Sheet) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 bg-card border-border p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Playlists</SheetTitle>
              <SheetDescription>Manage your saved playlists</SheetDescription>
            </SheetHeader>
            <PlaylistSidebarContent
              playlists={displayPlaylists}
              selectedPlaylistId={selectedPlaylistId}
              onSelectPlaylist={(id) => {
                setSelectedPlaylistId(id)
                setSidebarOpen(false)
              }}
              onCreatePlaylist={() => {
                handleCreatePlaylist()
              }}
              onDeletePlaylist={handleDeletePlaylist}
            />
            <AgentInfoSection isActive={activeAgentId !== null} />
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-[270px] bg-card border-r border-border flex-shrink-0">
          <PlaylistSidebarContent
            playlists={displayPlaylists}
            selectedPlaylistId={selectedPlaylistId}
            onSelectPlaylist={setSelectedPlaylistId}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
          />
          <AgentInfoSection isActive={activeAgentId !== null} />
        </aside>

        {/* Main Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 text-muted-foreground"
                onClick={() => setSidebarOpen(true)}
              >
                <FiMenu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <RiMusic2Fill className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h1 className="font-bold text-base tracking-tight">MusicMate</h1>
                  <p className="text-[10px] text-muted-foreground -mt-0.5">AI Music Discovery</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sample Data</span>
              <Switch
                checked={sampleMode}
                onCheckedChange={(checked) => {
                  setSampleMode(checked)
                  if (!checked) {
                    setSelectedPlaylistId(null)
                  }
                }}
              />
            </div>
          </header>

          {/* Selected Playlist View */}
          {selectedPlaylist && (
            <div className="border-b border-border bg-secondary/30 px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RiPlayListFill className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-sm">{selectedPlaylist.name}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {selectedPlaylist.tracks.length} tracks
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                  onClick={() => setSelectedPlaylistId(null)}
                >
                  Close
                </Button>
              </div>
              {selectedPlaylist.tracks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No tracks yet. Add tracks from recommendations.</p>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {selectedPlaylist.tracks.map((track, idx) => (
                      <div
                        key={`${track.title}-${track.artist}-${idx}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">{idx + 1}</span>
                          <BsMusicNoteBeamed className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{track?.title ?? 'Unknown'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{track?.artist ?? 'Unknown'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {track?.url && (
                            <a
                              href={track.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <FiExternalLink className="w-3 h-3 text-muted-foreground hover:text-accent" />
                            </a>
                          )}
                          {!sampleMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveFromPlaylist(selectedPlaylist.id, idx)}
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Chat Messages */}
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {displayMessages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                    <IoMusicalNotes className="w-8 h-8 text-accent/60" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2 tracking-tight">Discover Free Music</h2>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Tell me what kind of music you are into and I will find free tracks you will love.
                    Describe a mood, genre, or activity.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-6 justify-center">
                    {['Chill lo-fi for studying', 'Upbeat indie rock', 'Ambient electronic', 'Jazzy beats'].map((suggestion) => (
                      <button
                        key={suggestion}
                        className="px-3 py-1.5 text-xs bg-secondary/80 hover:bg-accent/20 hover:text-accent rounded-full transition-colors text-muted-foreground border border-border/50"
                        onClick={() => {
                          if (!sampleMode) {
                            setInputValue(suggestion)
                            inputRef.current?.focus()
                          }
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {displayMessages.map((msg) => (
                <div key={msg.id} className={cn('mb-4', msg.role === 'user' ? 'flex justify-end' : 'flex justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                      <IoMusicalNotes className="w-4 h-4 text-accent" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] md:max-w-[75%]',
                      msg.role === 'user'
                        ? 'bg-accent text-accent-foreground rounded-2xl rounded-br-md px-4 py-2.5'
                        : 'space-y-3'
                    )}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <>
                        <div className="bg-secondary/40 rounded-2xl rounded-bl-md px-4 py-3">
                          {renderMarkdown(msg.content)}
                        </div>
                        {Array.isArray(msg.tracks) && msg.tracks.length > 0 && (
                          <div className="space-y-2 pl-0">
                            {msg.tracks.map((track, idx) => (
                              <TrackCard
                                key={`${track?.title ?? ''}-${track?.artist ?? ''}-${idx}`}
                                track={track}
                                playlists={displayPlaylists}
                                onAddToPlaylist={handleAddToPlaylist}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        msg.role === 'user' ? 'text-accent-foreground/60 text-right' : 'text-muted-foreground'
                      )}
                    >
                      {msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  </div>
                </div>
              ))}

              {loading && <TypingIndicator />}

              {errorMessage && (
                <div className="flex justify-center mb-4">
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg px-4 py-2 text-xs max-w-md text-center">
                    {errorMessage}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Bar */}
          <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={sampleMode ? 'Toggle off sample data to chat...' : 'Describe your mood, genre, or ask for recommendations...'}
                disabled={loading || sampleMode}
                className="flex-1 bg-secondary/50 border-border/50 focus-visible:ring-accent placeholder:text-muted-foreground/50 text-sm h-10"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !inputValue.trim() || sampleMode}
                className="h-10 w-10 bg-accent hover:bg-accent/80 text-accent-foreground flex-shrink-0"
                size="icon"
              >
                <IoSend className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

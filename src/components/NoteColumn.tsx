import React, { useState, useRef } from 'react';
import { Plus, Trash2, Check, X, User, GripVertical, Heart, Smile, Image, Link, Upload, AlertCircle } from 'lucide-react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';

interface Note {
  id: string;
  content: string;
  type: 'glad' | 'mad' | 'sad' | 'action';
  created_by: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  user_liked: boolean;
  liked_by?: Array<{ user_id: string; user_name: string; created_at: string }>;
}

interface NoteColumnProps {
  title: string;
  subtitle: string;
  type: 'glad' | 'mad' | 'sad' | 'action';
  notes: Note[];
  onAddNote: (type: 'glad' | 'mad' | 'sad' | 'action', content: string) => void;
  onUpdateNote: (noteId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleLike: (noteId: string) => void;
  currentUserId: string;
  getUserDisplayName: (userId: string) => string;
  getUserAvatarUrl: (userId: string) => string | null;
  color: 'green' | 'red' | 'yellow' | 'blue';
  disabled?: boolean;
  typingIndicators?: Record<string, { userId: string; userName: string; timestamp: number }>;
  onTypingStart?: (noteId: string) => void;
  onTypingStop?: (noteId: string) => void;
  likedBy: (noteId: string) => Promise<Array<{ user_id: string; user_name: string; created_at: string }>>;
}

export function NoteColumn({ 
  title, 
  subtitle, 
  type, 
  notes, 
  onAddNote, 
  onUpdateNote, 
  onDeleteNote, 
  onToggleLike,
  currentUserId, 
  getUserDisplayName,
  getUserAvatarUrl,
  color,
  disabled = false,
  typingIndicators,
  onTypingStart,
  onTypingStop,
  likedBy
}: NoteColumnProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [activeTextarea, setActiveTextarea] = useState<'new' | 'edit' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'url' | 'upload'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [likeTooltip, setLikeTooltip] = useState<{ noteId: string; likes: Array<{ user_id: string; user_name: string; created_at: string }> } | null>(null);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  // Handle typing indicators with debouncing
  const handleTypingStart = (noteId: string) => {
    if (onTypingStart) {
      onTypingStart(noteId);
      
      // Clear existing timeout for this note
      if (typingTimeoutRef.current[noteId]) {
        clearTimeout(typingTimeoutRef.current[noteId]);
      }
      
      // Set timeout to stop typing indicator after 1 second of inactivity
      typingTimeoutRef.current[noteId] = setTimeout(() => {
        if (onTypingStop) {
          onTypingStop(noteId);
        }
        delete typingTimeoutRef.current[noteId];
      }, 1000);
    }
  };

  const handleTypingStop = (noteId: string) => {
    if (onTypingStop) {
      onTypingStop(noteId);
    }
    
    if (typingTimeoutRef.current[noteId]) {
      clearTimeout(typingTimeoutRef.current[noteId]);
      delete typingTimeoutRef.current[noteId];
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Common emojis for retrospectives
  const commonEmojis = [
    '😊', '😢', '😡', '🎉', '👍', '👎', '💡', '🔥', '⚡', '🚀',
    '✅', '❌', '⚠️', '🎯', '📈', '📉', '🔧', '🐛', '💪', '🤝',
    '💭', '💬', '📝', '📊', '🏆', '🎊', '🌟', '💯', '🔴', '🟢',
    '🟡', '🔵', '⭐', '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤'
  ];

  const colorClasses = {
    green: {
      header: 'from-green-500 to-emerald-500',
      border: 'border-green-200',
      bg: 'bg-green-50',
      text: 'text-green-700',
      button: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
      note: 'bg-green-100 border-green-200 hover:border-green-300',
      userBadge: 'bg-green-200 text-green-800',
      dropZone: 'border-green-300 bg-green-50',
    },
    red: {
      header: 'from-red-500 to-rose-500',
      border: 'border-red-200',
      bg: 'bg-red-50',
      text: 'text-red-700',
      button: 'from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600',
      note: 'bg-red-100 border-red-200 hover:border-red-300',
      userBadge: 'bg-red-200 text-red-800',
      dropZone: 'border-red-300 bg-red-50',
    },
    yellow: {
      header: 'from-yellow-500 to-orange-500',
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      button: 'from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600',
      note: 'bg-yellow-100 border-yellow-200 hover:border-yellow-300',
      userBadge: 'bg-yellow-200 text-yellow-800',
      dropZone: 'border-yellow-300 bg-yellow-50',
    },
    blue: {
      header: 'from-blue-500 to-indigo-500',
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      button: 'from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
      note: 'bg-blue-100 border-blue-200 hover:border-blue-300',
      userBadge: 'bg-blue-200 text-blue-800',
      dropZone: 'border-blue-300 bg-blue-50',
    },
  };

  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newNoteContent.trim() && !isSubmitting && !disabled) {
      setIsSubmitting(true);
      console.log('Adding note:', { type, content: newNoteContent.trim(), currentUserId });
      
      try {
        await onAddNote(type, newNoteContent.trim());
        setNewNoteContent('');
        setShowAddForm(false);
      } catch (error) {
        console.error('Error adding note:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdateNote();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleNoteClick = (note: Note) => {
    // Only allow editing if the current user owns the note and meeting is not disabled
    if (note.created_by === currentUserId && editingNote !== note.id && !disabled) {
      setEditingNote(note.id);
      setEditContent(note.content);
    }
  };

  const handleUpdateNote = async () => {
    if (editingNote && editContent.trim() && !isSubmitting && !disabled) {
      setIsSubmitting(true);
      try {
        await onUpdateNote(editingNote, editContent.trim());
        handleTypingStop(editingNote);
        setEditingNote(null);
        setEditContent('');
      } catch (error) {
        console.error('Error updating note:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelEdit = () => {
    if (editingNote) {
      handleTypingStop(editingNote);
    }
    setEditingNote(null);
    setEditContent('');
  };

  const handleEditContentChange = (noteId: string, content: string) => {
    setEditContent(content);
    handleTypingStart(noteId);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!isSubmitting && !disabled) {
      setIsSubmitting(true);
      try {
        await onDeleteNote(noteId);
      } catch (error) {
        console.error('Error deleting note:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleLike = async (noteId: string) => {
    if (!disabled) {
      try {
        await onToggleLike(noteId);
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = activeTextarea === 'new' 
      ? document.querySelector('textarea[data-type="new"]') as HTMLTextAreaElement
      : document.querySelector('textarea[data-type="edit"]') as HTMLTextAreaElement;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = activeTextarea === 'new' ? newNoteContent : editContent;
      const newValue = currentValue.substring(0, start) + emoji + currentValue.substring(end);
      
      if (activeTextarea === 'new') {
        setNewNoteContent(newValue);
      } else {
        setEditContent(newValue);
      }
      
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    
    setShowEmojiPicker(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size must be less than 10MB');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      // Create unique filename with user ID folder structure for RLS
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserId}/note-${Date.now()}.${fileExt}`;

      console.log('🔄 Starting note image upload...', { fileName, fileSize: file.size, fileType: file.type });

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('❌ Upload error details:', uploadError);
        setUploadError(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('note-images')
        .getPublicUrl(fileName);

      console.log('🔗 Public URL:', urlData.publicUrl);
      
      // Insert the uploaded image into the note
      insertImageWithUrl(urlData.publicUrl, file.name);
      
      // Close dialog on successful upload
      handleImageDialogClose();
      
    } catch (err: any) {
      console.error('💥 Unexpected error uploading image:', err);
      setUploadError(`Failed to upload image: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const insertImageWithUrl = (url: string, altText: string = 'Image') => {
    const imageMarkdown = `![${altText}](${url})`;
    const textarea = activeTextarea === 'new' 
      ? document.querySelector('textarea[data-type="new"]') as HTMLTextAreaElement
      : document.querySelector('textarea[data-type="edit"]') as HTMLTextAreaElement;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = activeTextarea === 'new' ? newNoteContent : editContent;
      const newValue = currentValue.substring(0, start) + imageMarkdown + currentValue.substring(end);
      
      if (activeTextarea === 'new') {
        setNewNoteContent(newValue);
      } else {
        setEditContent(newValue);
      }
      
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + imageMarkdown.length, start + imageMarkdown.length);
      }, 0);
    }
  };

  const insertImage = () => {
    if (imageUrl.trim()) {
      insertImageWithUrl(imageUrl.trim());
    }
    
    // Reset state
    setImageUrl('');
    setShowImageDialog(false);
    setUploadMethod('url');
    setUploadError('');
  };

  const handleImageDialogClose = () => {
    setShowImageDialog(false);
    setImageUrl('');
    setUploadMethod('url');
    setUploadError('');
  };

  const renderNoteContent = (content: string) => {
    if (!content) return '';

    // Simple markdown-like rendering for images and URLs
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // First, let's check if there are any images or URLs to process
    const hasImages = imageRegex.test(content);
    const hasUrls = urlRegex.test(content);
    
    // Reset regex lastIndex
    imageRegex.lastIndex = 0;
    urlRegex.lastIndex = 0;
    
    // If no special content, return as-is
    if (!hasImages && !hasUrls) {
      return content;
    }
    
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    // Handle images first
    const contentWithoutImages = content.replace(imageRegex, (match, alt, src, offset) => {
      // Add text before image
      if (offset > lastIndex) {
        parts.push(content.substring(lastIndex, offset));
      }
      
      // Add image element
      const imageKey = `img-${offset}-${src}`;
      parts.push(
        <img 
          key={imageKey}
          src={src} 
          alt={alt} 
          className="max-w-full h-auto rounded-lg my-2 border border-gray-200"
          style={{ maxHeight: '200px' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            // Show fallback text
            const fallback = document.createElement('div');
            fallback.className = 'text-gray-500 text-sm italic p-2 bg-gray-100 rounded border-2 border-dashed border-gray-300';
            fallback.textContent = `🖼️ Image: ${alt || 'Failed to load'}`;
            target.parentNode?.insertBefore(fallback, target);
          }}
        />
      );
      
      lastIndex = offset + match.length;
      return ''; // Remove from text content
    });
    
    // If we processed images, handle the remaining text
    if (hasImages) {
      // Add remaining text after last image
      if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        
        // Process URLs in remaining text
        if (hasUrls) {
          const urlParts: (string | React.ReactElement)[] = [];
          let urlLastIndex = 0;
          
          while ((match = urlRegex.exec(remainingText)) !== null) {
            if (match.index > urlLastIndex) {
              urlParts.push(remainingText.substring(urlLastIndex, match.index));
            }
            
            urlParts.push(
              <a 
                key={`url-${match.index}-${match[0]}`}
                href={match[0]} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {match[0]}
              </a>
            );
            
            urlLastIndex = urlRegex.lastIndex;
          }
          
          if (urlLastIndex < remainingText.length) {
            urlParts.push(remainingText.substring(urlLastIndex));
          }
          
          parts.push(...urlParts);
        } else {
          parts.push(remainingText);
        }
      }
      
      return parts.length > 0 ? parts : content;
    }
    
    // If no images but has URLs, process URLs only
    if (hasUrls) {
      const urlParts: (string | React.ReactElement)[] = [];
      let urlLastIndex = 0;
      
      while ((match = urlRegex.exec(content)) !== null) {
        if (match.index > urlLastIndex) {
          urlParts.push(content.substring(urlLastIndex, match.index));
        }
        
        urlParts.push(
          <a 
            key={`url-${match.index}-${match[0]}`}
            href={match[0]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {match[0]}
          </a>
        );
        
        urlLastIndex = urlRegex.lastIndex;
      }
      
      if (urlLastIndex < content.length) {
        urlParts.push(content.substring(urlLastIndex));
      }
      
      return urlParts.length > 0 ? urlParts : content;
    }
    
    // Fallback - return original content
    return content;
  };

  // Handle showing like tooltip on hover
  const handleLikeHover = async (noteId: string) => {
    if (isLoadingLikes || likeTooltip?.noteId === noteId) return;
    
    setIsLoadingLikes(true);
    try {
      const likes = await likedBy(noteId);
      setLikeTooltip({ noteId, likes });
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setIsLoadingLikes(false);
    }
  };

  const handleLikeLeave = () => {
    setLikeTooltip(null);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden ${colorClasses[color].border} border-2 ${disabled ? 'opacity-75' : ''}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colorClasses[color].header} p-6 text-white`}>
        <h2 className="text-2xl font-bold mb-1">{title}</h2>
        <p className="text-white/90">{subtitle}</p>
        <div className="mt-4 text-sm bg-white/20 rounded-lg px-3 py-1 inline-block">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </div>
        {disabled && (
          <div className="mt-2 text-xs bg-white/30 rounded-lg px-2 py-1 inline-block">
            Meeting Ended
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Add Note Form */}
        {!disabled && (showAddForm ? (
          <form onSubmit={handleAddNote} className="mb-6">
            <div className="relative">
              <textarea
                data-type="new"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setActiveTextarea('new')}
                placeholder={`Add ${type === 'action' ? 'an action item' : `a ${type} note`}... (Press Enter to add, Shift+Enter for new line)`}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y min-h-[4rem] max-h-[20rem]"
                rows={3}
                autoFocus
                required
                disabled={isSubmitting}
              />
              
              {/* Toolbar */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1">
                  {/* Emoji Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTextarea('new');
                        setShowEmojiPicker(!showEmojiPicker);
                      }}
                      className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Add emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    
                    {/* Emoji Picker */}
                    {showEmojiPicker && activeTextarea === 'new' && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 w-64">
                        <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                          {commonEmojis.map((emoji, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="p-1 hover:bg-gray-100 rounded text-lg"
                              title={`Add ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Image Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTextarea('new');
                      setShowImageDialog(true);
                    }}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Add image"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={isSubmitting || !newNoteContent.trim()}
                className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${colorClasses[color].button} text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Adding...' : `Add ${type === 'action' ? 'Action' : 'Note'}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewNoteContent('');
                  setShowEmojiPicker(false);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Drag bottom-right corner to resize. Use emojis 😊 and images!
            </p>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={isSubmitting}
            className={`w-full mb-6 p-4 border-2 border-dashed ${colorClasses[color].border} ${colorClasses[color].bg} ${colorClasses[color].text} rounded-lg hover:border-solid hover:shadow-md transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Plus className="w-5 h-5" />
            Add {title}
          </button>
        ))}

        {disabled && (
          <div className="mb-6 p-4 border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 rounded-lg text-center font-medium">
            Meeting has ended - no new notes can be added
          </div>
        )}

        {/* Droppable Notes Area */}
        <Droppable droppableId={type} isDropDisabled={disabled}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-3 min-h-[100px] rounded-lg transition-colors ${
                snapshot.isDraggingOver && !disabled
                  ? `border-2 border-dashed ${colorClasses[color].dropZone} p-2` 
                  : ''
              }`}
            >
              {notes.map((note, index) => (
                <Draggable key={note.id} draggableId={note.id} index={index} isDragDisabled={disabled}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`p-4 rounded-lg border-2 ${colorClasses[color].note} transition-all group relative ${
                        snapshot.isDragging ? 'shadow-lg rotate-2 scale-105 z-50' : ''
                      }`}
                      style={{
                        ...provided.draggableProps.style,
                        transform: snapshot.isDragging 
                          ? `${provided.draggableProps.style?.transform} rotate(2deg)` 
                          : provided.draggableProps.style?.transform,
                      }}
                    >
                      {/* Drag Handle - Only show if not disabled */}
                      {!disabled && (
                        <div
                          {...provided.dragHandleProps}
                          className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing transition-colors bg-gray-100 hover:bg-gray-200 rounded-md"
                          title="Drag to move between columns"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}

                      {editingNote === note.id ? (
                        <div className={disabled ? '' : 'pr-12'}>
                          <div className="relative">
                            <textarea
                              data-type="edit"
                              value={editContent}
                              onChange={(e) => handleEditContentChange(note.id, e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onFocus={() => setActiveTextarea('edit')}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y min-h-[4rem] max-h-[20rem]"
                              rows={3}
                              autoFocus
                              disabled={isSubmitting || disabled}
                              placeholder="Press Enter to save, Escape to cancel"
                            />
                            
                            {/* Edit Toolbar */}
                            <div className="flex items-center gap-1 mt-2">
                              {/* Emoji Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTextarea('edit');
                                    setShowEmojiPicker(!showEmojiPicker);
                                  }}
                                  className="p-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="Add emoji"
                                >
                                  <Smile className="w-3 h-3" />
                                </button>
                                
                                {/* Emoji Picker */}
                                {showEmojiPicker && activeTextarea === 'edit' && (
                                  <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 w-64">
                                    <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                                      {commonEmojis.map((emoji, index) => (
                                        <button
                                          key={index}
                                          type="button"
                                          onClick={() => insertEmoji(emoji)}
                                          className="p-1 hover:bg-gray-100 rounded text-lg"
                                          title={`Add ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Image Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTextarea('edit');
                                  setShowImageDialog(true);
                                }}
                                className="p-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Add image"
                              >
                                <Image className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={handleUpdateNote}
                              disabled={isSubmitting || !editContent.trim() || disabled}
                              className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Check className="w-3 h-3" />
                              {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSubmitting}
                              className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            💡 Tip: Drag corner to resize.
                          </p>
                        </div>
                      ) : (
                        <div className={disabled ? '' : 'pr-12'}>
                          <div className="flex items-start justify-between mb-2">
                            <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${colorClasses[color].userBadge}`}>
                              <Avatar 
                                src={getUserAvatarUrl(note.created_by)}
                                alt={`${getUserDisplayName(note.created_by)}'s avatar`}
                                size="xs"
                                userId={note.created_by}
                                className="flex-shrink-0"
                              />
                              {getUserDisplayName(note.created_by)}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex items-center gap-1">
                              {/* Like button */}
                              <div className="relative">
                                <button
                                  onClick={() => handleToggleLike(note.id)}
                                  onMouseEnter={() => handleLikeHover(note.id)}
                                  onMouseLeave={handleLikeLeave}
                                  disabled={disabled}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                    disabled 
                                      ? 'opacity-50 cursor-not-allowed' 
                                      : 'hover:bg-white/50 cursor-pointer'
                                  } ${
                                    note.user_liked 
                                      ? 'text-red-600' 
                                      : 'text-gray-600 hover:text-red-600'
                                  }`}
                                  title={disabled ? 'Meeting ended' : (note.user_liked ? 'Unlike this note' : 'Like this note')}
                                >
                                  <Heart 
                                    className={`w-4 h-4 ${note.user_liked ? 'fill-current' : ''}`} 
                                  />
                                  {note.like_count > 0 && (
                                    <span className="font-medium">{note.like_count}</span>
                                  )}
                                </button>

                                {/* Like Tooltip */}
                                {likeTooltip?.noteId === note.id && likeTooltip.likes.length > 0 && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-48 shadow-lg">
                                      <div className="text-center mb-1 font-medium">
                                        Liked by:
                                      </div>
                                      <div className="space-y-1">
                                        {likeTooltip.likes.map((like, index) => (
                                          <div key={like.user_id} className="text-center">
                                            {like.user_name}
                                          </div>
                                        ))}
                                      </div>
                                      {/* Tooltip arrow */}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}

                                {/* Loading indicator */}
                                {isLoadingLikes && likeTooltip?.noteId === note.id && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                                      <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-1 border-white"></div>
                                        Loading...
                                      </div>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Delete button - always visible but disabled for non-owners */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  disabled={isSubmitting || disabled || note.created_by !== currentUserId}
                                  className={`p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    note.created_by === currentUserId && !disabled
                                      ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                                      : 'text-gray-400 cursor-not-allowed'
                                  }`}
                                  title={
                                    note.created_by === currentUserId && !disabled
                                      ? 'Delete note'
                                      : 'Only note creator can delete'
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Clickable note content */}
                          <div
                            onClick={() => handleNoteClick(note)}
                            className={`mb-3 ${
                              note.created_by === currentUserId && !disabled
                                ? 'cursor-pointer hover:bg-white/50 rounded p-2 -m-2 transition-colors' 
                                : ''
                            }`}
                            title={note.created_by === currentUserId && !disabled ? 'Click to edit' : ''}
                          >
                            <div className="text-gray-800 whitespace-pre-wrap break-words">
                              {renderNoteContent(note.content)}
                            </div>
                          </div>
                          
                          {/* Typing Indicator */}
                          {typingIndicators && typingIndicators[note.id] && (
                            <div className="mb-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 animate-pulse">
                              <div className="flex items-center gap-1">
                                <div className="flex gap-0.5">
                                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span>{typingIndicators[note.id].userName} is typing...</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-500">
                              {new Date(note.created_at).toLocaleString()}
                              {note.updated_at !== note.created_at && (
                                <span className="ml-2 italic">(edited)</span>
                              )}
                            </p>
                            
                            {/* Edit hint for own notes */}
                            {note.created_by === currentUserId && !disabled && (
                              <p className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Click to edit
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {notes.length === 0 && !showAddForm && (
                <div className="text-center py-8 text-gray-500">
                  <p>No {type === 'action' ? 'action items' : `${type} notes`} yet</p>
                  {!disabled && (
                    <p className="text-sm">Click the button above to add one!</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>

      {/* Enhanced Image Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Image</h3>
            
            {/* Upload Method Tabs */}
            <div className="flex mb-4 border-b border-gray-200">
              <button
                onClick={() => setUploadMethod('url')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  uploadMethod === 'url'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                From URL
              </button>
              <button
                onClick={() => setUploadMethod('upload')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  uploadMethod === 'upload'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Upload File
              </button>
            </div>

            <div className="space-y-4">
              {/* URL Input Method */}
              {uploadMethod === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter a direct link to an image (jpg, png, gif, etc.)
                  </p>
                </div>
              )}

              {/* File Upload Method */}
              {uploadMethod === 'upload' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Image File
                  </label>
                  <div 
                    onClick={() => imageFileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to choose an image file
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG, GIF, WebP up to 10MB
                    </p>
                  </div>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Error Display */}
              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {/* Loading State */}
              {uploading && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-700">Uploading image...</p>
                </div>
              )}
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleImageDialogClose}
                  disabled={uploading}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {uploadMethod === 'url' && (
                  <button
                    onClick={insertImage}
                    disabled={!imageUrl.trim() || uploading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside handler for emoji picker */}
      {showEmojiPicker && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
}
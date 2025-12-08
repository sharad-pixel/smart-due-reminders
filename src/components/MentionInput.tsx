import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface MentionUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
  rows?: number;
  className?: string;
  onMentionsChange?: (mentions: string[]) => void;
}

export const MentionInput = ({
  value,
  onChange,
  users,
  placeholder = "Add a note... Use @ to mention team members",
  rows = 2,
  className,
  onMentionsChange
}: MentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Extract current mentions from value
  useEffect(() => {
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(value)) !== null) {
      mentions.push(match[2]); // user_id
    }
    onMentionsChange?.(mentions);
  }, [value, onMentionsChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check if we're typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space between @ and cursor (still typing mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const searchTerm = textAfterAt.toLowerCase();
        const filtered = users.filter(user => 
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm)
        );
        setFilteredUsers(filtered);
        setMentionStart(lastAtIndex);
        setShowSuggestions(filtered.length > 0);
        setSuggestionIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
    setMentionStart(null);
  };

  const insertMention = (user: MentionUser) => {
    if (mentionStart === null) return;
    
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(cursorPos);
    
    // Format: @[Name](user_id)
    const mentionText = `@[${user.name}](${user.user_id}) `;
    const newValue = beforeMention + mentionText + afterMention;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(null);
    
    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSuggestionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSuggestionIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (filteredUsers[suggestionIndex]) {
          e.preventDefault();
          insertMention(filteredUsers[suggestionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (filteredUsers[suggestionIndex]) {
          e.preventDefault();
          insertMention(filteredUsers[suggestionIndex]);
        }
        break;
    }
  };

  // Scroll selected suggestion into view
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[suggestionIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [suggestionIndex, showSuggestions]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("resize-none", className)}
        onBlur={() => {
          // Delay hiding to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 150);
        }}
      />
      
      {showSuggestions && filteredUsers.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.user_id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent flex flex-col",
                index === suggestionIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setSuggestionIndex(index)}
            >
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Utility to render note content with styled mentions
export const renderNoteWithMentions = (content: string): React.ReactNode => {
  if (!content) return content;
  
  // Pattern matches @[Name](uuid) format
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyIndex = 0;
  let match;

  // Reset regex state
  mentionPattern.lastIndex = 0;

  while ((match = mentionPattern.exec(content)) !== null) {
    const matchIndex = match.index;
    const fullMatch = match[0];
    const userName = match[1];

    // Add text before this mention
    if (matchIndex > lastIndex) {
      result.push(
        <span key={`text-${keyIndex++}`}>
          {content.slice(lastIndex, matchIndex)}
        </span>
      );
    }

    // Add styled mention - display only the name, not the ID
    result.push(
      <span 
        key={`mention-${keyIndex++}`}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium"
      >
        @{userName}
      </span>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // If no matches found, return original content
  if (result.length === 0) {
    return content;
  }

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    result.push(
      <span key={`text-${keyIndex++}`}>
        {content.slice(lastIndex)}
      </span>
    );
  }

  return result;
};

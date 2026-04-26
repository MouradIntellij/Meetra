import { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext(null);

export const useUI = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be inside UIProvider');
  return ctx;
};

export function UIProvider({ children }) {

  const [layout, setLayout] = useState('grid');
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [breakoutOpen, setBreakoutOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const [reactions, setReactions] = useState([]);

  const addReaction = useCallback((reaction) => {
    const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `reaction-${Date.now()}-${Math.random()}`;

    setReactions(prev => [...prev, { ...reaction, id }]);

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3500);
  }, []);

  const toggleLayout = useCallback(
      () => setLayout(l => l === 'grid' ? 'spotlight' : 'grid'),
      []
  );

  return (
      <UIContext.Provider value={{
        layout,
        setLayout,
        toggleLayout,

        activeSpeakerId,
        setActiveSpeakerId,

        chatOpen,
        setChatOpen,

        chatUnread,
        setChatUnread,

        participantsOpen,
        setParticipantsOpen,

        whiteboardOpen,
        setWhiteboardOpen,

        breakoutOpen,
        setBreakoutOpen,

        transcriptOpen,
        setTranscriptOpen,

        reactions,
        addReaction,
      }}>
        {children}
      </UIContext.Provider>
  );
}

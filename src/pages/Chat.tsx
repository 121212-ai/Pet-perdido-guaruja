import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { MessageCircle, Search, ChevronRight, User, AlertCircle, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatSession, PetListing } from '../types';

interface Conversation extends ChatSession {
  pet?: PetListing;
}

const ChatPage: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convsData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as ChatSession;
        
        // Fetch pet info
        let pet: PetListing | undefined;
        if (data.petId) {
          const petDoc = await getDoc(doc(db, 'pets', data.petId));
          if (petDoc.exists()) {
            pet = { id: petDoc.id, ...petDoc.data() } as PetListing;
          }
        }

        return {
          id: d.id,
          ...data,
          pet
        } as Conversation;
      }));

      setConversations(convsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredConversations = conversations.filter(c => 
    c.pet?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.petName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja arquivar esta conversa?')) return;
    try {
      // In a real app, we might just archive it by removing the user from participants
      // or setting a flag. For now, we'll just delete it for simplicity if requested.
      await deleteDoc(doc(db, 'conversations', id));
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-6 pt-16 pb-8 bg-white sticky top-0 z-50 border-b border-gray-50">
        <h1 className="text-3xl font-black text-gray-900 mb-6">Mensagens</h1>
        
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversas..."
            className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 text-gray-800 placeholder:text-gray-400 focus:outline-none border border-gray-100 font-bold"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="px-6 mt-6">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-gray-50 p-8 rounded-[40px] mb-6">
              <MessageCircle size={48} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Nenhuma conversa</h3>
            <p className="text-gray-500 font-bold text-sm max-w-[200px]">
              {searchQuery ? 'Nenhuma conversa encontrada para sua busca.' : 'Inicie uma conversa clicando em "Oferecer Ajuda" em um anúncio.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <motion.div 
                key={conv.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <div 
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="flex items-center gap-4 p-4 rounded-[32px] bg-white hover:bg-gray-50 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-gray-100"
                >
                  <div className="relative">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 overflow-hidden">
                      {conv.pet?.photos?.[0] || conv.petPhoto ? (
                        <img src={conv.pet?.photos?.[0] || conv.petPhoto} className="w-full h-full object-cover" alt="pet" />
                      ) : (
                        <div className="bg-primary/20 w-full h-full flex items-center justify-center">
                          <img src="https://api.iconify.design/mdi:paw.svg?color=%23FF6321" className="w-8 h-8 opacity-20" alt="paw" />
                        </div>
                      )}
                    </div>
                    {/* @ts-ignore */}
                    {conv.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-perdido text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                        {/* @ts-ignore */}
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-gray-900 truncate">{conv.pet?.name || conv.petName || 'Pet'}</h4>
                        {conv.status === 'resolvido' && (
                          <span className="bg-green-100 text-green-600 text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest">
                            <CheckCircle2 size={8} />
                            Resolvido
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {conv.lastMessageAt ? formatDistanceToNow(conv.lastMessageAt.toDate(), { locale: ptBR }) : ''}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-500 truncate leading-tight">
                      {conv.lastMessage || 'Inicie uma conversa...'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={20} className="text-gray-300" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;

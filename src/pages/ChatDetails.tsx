import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, limit } from 'firebase/firestore';
import { ChevronLeft, Send, User, MoreVertical, Phone, AlertCircle, Loader2, Image as ImageIcon, MapPin, PawPrint, ShieldAlert, DollarSign, ExternalLink, MessageCircle, CheckCircle2, HeartHandshake } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Message, ChatSession, PetListing, Reward } from '../types';

const ChatDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [pet, setPet] = useState<PetListing | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch chat session and pet info
    const unsubscribeSession = onSnapshot(doc(db, 'conversations', id), async (docSnap) => {
      if (docSnap.exists()) {
        const sessionData = { id: docSnap.id, ...docSnap.data() } as ChatSession;
        setChatSession(sessionData);

        if (sessionData.petId) {
          const petDoc = await getDoc(doc(db, 'pets', sessionData.petId));
          if (petDoc.exists()) {
            setPet({ id: petDoc.id, ...petDoc.data() } as PetListing);
          }
        }
      }
    });

    // Fetch messages
    const q = query(
      collection(db, 'conversations', id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgsData);
      setLoading(false);
      
      // Mark as read (simplified)
      updateDoc(doc(db, 'conversations', id), {
        unreadCount: 0
      }).catch(console.error);
    }, (error) => {
      console.error('Error fetching messages:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeSession();
      unsubscribeMessages();
    };
  }, [id, user]);

  useEffect(() => {
    if (!pet?.id) return;
    const q = query(
      collection(db, 'rewards'),
      where('petId', '==', pet.id),
      where('status', '==', 'escrow'),
      limit(1)
    );
    const unsubscribeReward = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setReward({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Reward);
      } else {
        setReward(null);
      }
    });
    return () => unsubscribeReward();
  }, [pet?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (type: 'text' | 'image' | 'location' | 'system' = 'text', content?: any) => {
    if (!id || !user) return;
    
    let messageData: any = {
      senderId: user.uid,
      type,
      createdAt: serverTimestamp(),
      read: false,
    };

    if (type === 'text') {
      if (!newMessage.trim()) return;
      messageData.text = newMessage.trim();
      setNewMessage('');
    } else if (type === 'image') {
      messageData.imageURL = content;
      messageData.text = '📷 Foto enviada';
    } else if (type === 'location') {
      messageData.location = content;
      messageData.text = '📍 Localização compartilhada';
    } else if (type === 'system') {
      messageData.text = content;
    }

    setIsSending(true);
    try {
      await addDoc(collection(db, 'conversations', id, 'messages'), messageData);

      await updateDoc(doc(db, 'conversations', id), {
        lastMessage: messageData.text,
        lastMessageAt: serverTimestamp(),
        unreadCount: increment(1)
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate upload
    const reader = new FileReader();
    reader.onload = (event) => {
      handleSendMessage('image', event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        handleSendMessage('location', {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  };

  const handlePayReward = () => {
    if (!pet) return;
    navigate(`/payment/${pet.id}`);
  };

  const handleReleaseReward = async () => {
    if (!reward || !pet || !user) return;
    
    if (window.confirm('Você confirma que recebeu seu pet e deseja liberar a recompensa para quem o encontrou?')) {
      try {
        setIsSending(true);
        // Update reward status
        await updateDoc(doc(db, 'rewards', reward.id), {
          status: 'released',
          releasedAt: serverTimestamp()
        });

        // Update pet status
        await updateDoc(doc(db, 'pets', pet.id), {
          status: 'encontrado'
        });

        // Update chat session
        await updateDoc(doc(db, 'conversations', id!), {
          rewardPaid: true,
          status: 'resolvido'
        });

        await handleSendMessage('system', `✅ Recompensa de R$ ${reward.amount} liberada! Pet marcado como ENCONTRADO.`);
        
        alert('Recompensa liberada com sucesso! Obrigado por usar nossa plataforma.');
      } catch (error) {
        console.error('Error releasing reward:', error);
        alert('Erro ao liberar recompensa. Tente novamente.');
      } finally {
        setIsSending(false);
      }
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
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 z-50 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/chat')} className="p-2 -ml-2 text-gray-900 active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 overflow-hidden">
              {pet?.photos?.[0] || chatSession?.petPhoto ? (
                <img src={pet?.photos?.[0] || chatSession?.petPhoto} className="w-full h-full object-cover" alt="pet" />
              ) : (
                <PawPrint size={20} className="text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-gray-900 text-sm leading-tight">{pet?.name || chatSession?.petName || 'Pet'}</h4>
                {pet?.status && (
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                    pet.status === 'perdido' ? 'bg-perdido/10 text-perdido' : 'bg-green-100 text-green-600'
                  }`}>
                    {pet.status}
                  </span>
                )}
              </div>
              <button 
                onClick={() => navigate(`/pet/${pet?.id}`)}
                className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 mt-0.5"
              >
                Ver Pet <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 active:scale-95 transition-transform">
            <Phone size={20} />
          </button>
          <button className="p-2 text-gray-400 active:scale-95 transition-transform">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex items-center gap-3">
        <ShieldAlert size={18} className="text-amber-500 shrink-0" />
        <p className="text-[10px] font-bold text-amber-700 leading-tight">
          SEGURANÇA: Nunca compartilhe dados bancários ou faça pagamentos fora da plataforma.
        </p>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="bg-primary/5 p-6 rounded-full mb-4">
              <MessageCircle size={32} className="text-primary/30" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Inicie a conversa</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            const showDate = index === 0 || !isSameDay(messages[index - 1].createdAt?.toDate(), msg.createdAt?.toDate());
            
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-primary/20">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <React.Fragment key={msg.id}>
                {showDate && msg.createdAt && (
                  <div className="flex justify-center my-6">
                    <span className="bg-gray-200/50 text-gray-500 text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">
                      {format(msg.createdAt.toDate(), "d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, x: isMe ? 20 : -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] ${
                    isMe 
                      ? 'bg-primary text-white rounded-3xl rounded-tr-lg shadow-lg shadow-primary/20' 
                      : 'bg-white text-gray-800 rounded-3xl rounded-tl-lg shadow-sm border border-gray-100'
                  } overflow-hidden`}>
                    
                    {msg.type === 'image' && msg.imageURL && (
                      <div className="p-1">
                        <img 
                          src={msg.imageURL} 
                          alt="shared" 
                          className="w-full h-auto rounded-2xl max-h-60 object-cover cursor-pointer"
                          onClick={() => window.open(msg.imageURL, '_blank')}
                        />
                      </div>
                    )}

                    {msg.type === 'location' && msg.location && (
                      <div className="p-1">
                        <div className="bg-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2">
                          <MapPin size={32} className="text-primary" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Localização compartilhada</p>
                          <button 
                            onClick={() => window.open(`https://www.google.com/maps?q=${msg.location?.latitude},${msg.location?.longitude}`, '_blank')}
                            className="bg-white text-primary text-[10px] font-black px-4 py-2 rounded-xl shadow-sm border border-gray-100 uppercase tracking-widest"
                          >
                            Ver no Mapa
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-4">
                      <p className="text-sm font-bold leading-relaxed">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                          {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                        </p>
                        {isMe && (
                          <div className={msg.read ? 'text-white' : 'text-white/40'}>
                            <CheckCircle2 size={10} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Reward Buttons */}
      {pet?.hasReward && !chatSession?.rewardPaid && (
        <div className="px-6 pb-2 space-y-2">
          {/* If owner and reward is in escrow, show release button */}
          {pet.ownerId === user?.uid && reward && (
            <button 
              onClick={handleReleaseReward}
              disabled={isSending}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-transform disabled:opacity-50"
            >
              <CheckCircle2 size={20} />
              {isSending ? 'Processando...' : 'Recebi meu pet! Liberar recompensa'}
            </button>
          )}

          {/* If owner and NO reward in escrow, show pay button */}
          {pet.ownerId === user?.uid && !reward && (
            <button 
              onClick={handlePayReward}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              <DollarSign size={20} />
              Garantir Recompensa (R$ {pet.rewardAmount})
            </button>
          )}

          {/* If NOT owner and reward is in escrow, show status for finder */}
          {pet.ownerId !== user?.uid && reward && (
            <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center gap-3">
              <div className="bg-green-500 p-2 rounded-full text-white">
                <ShieldAlert size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Recompensa em Escrow</p>
                <p className="text-[10px] font-bold text-green-600 leading-tight">
                  O valor de R$ {reward.amount} já foi pago pelo dono e está seguro. Será liberado assim que ele confirmar o recebimento.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="bg-white p-6 border-t border-gray-100 safe-area-bottom">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-primary transition-colors active:scale-90"
            >
              <ImageIcon size={24} />
            </button>
            <button 
              onClick={handleShareLocation}
              className="p-3 text-gray-400 hover:text-primary transition-colors active:scale-90"
            >
              <MapPin size={24} />
            </button>
          </div>
          
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          <div className="flex-1 relative">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escreva uma mensagem..."
              className="w-full bg-gray-50 rounded-2xl py-4 px-6 text-gray-800 placeholder:text-gray-400 focus:outline-none border border-gray-100 font-bold"
            />
          </div>

          <button 
            onClick={() => handleSendMessage()}
            disabled={!newMessage.trim() || isSending}
            className="bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50"
          >
            {isSending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDetails;

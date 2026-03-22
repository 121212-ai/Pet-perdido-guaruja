import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Share2, Heart, Eye, MessageCircle } from 'lucide-react';
import { PetListing } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface PetCardProps {
  pet: PetListing;
  onAction?: (action: string) => void;
}

const PetCard: React.FC<PetCardProps> = ({ pet, onAction }) => {
  const navigate = useNavigate();
  const isPerdido = pet.status === 'perdido';
  const isEncontrado = pet.status === 'encontrado';
  const isAvistado = pet.status === 'avistado';

  const handleShare = async () => {
    const shareData = {
      title: `Pet ${pet.status === 'perdido' ? 'Perdido' : 'Encontrado'}: ${pet.name || 'Sem nome'}`,
      text: `${pet.description}\n\nVisto em: ${pet.lastSeenNeighborhood}\n\nAjude-nos a encontrar!`,
      url: `${window.location.origin}/pet/${pet.id}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copiado para a área de transferência!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleOfferHelp = async () => {
    if (!auth.currentUser) {
      navigate('/auth');
      return;
    }

    if (auth.currentUser.uid === pet.ownerId) {
      alert('Você é o dono deste pet!');
      return;
    }

    try {
      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', auth.currentUser.uid),
        where('petId', '==', pet.id)
      );
      
      const snapshot = await getDocs(q);
      let conversationId = '';

      if (!snapshot.empty) {
        conversationId = snapshot.docs[0].id;
      } else {
        // Create new conversation
        const newConv = await addDoc(collection(db, 'conversations'), {
          participants: [auth.currentUser.uid, pet.ownerId],
          petId: pet.id,
          lastMessage: 'Olá! Gostaria de oferecer ajuda com seu pet.',
          lastMessageAt: serverTimestamp(),
          unreadCount: 1,
          createdAt: serverTimestamp(),
        });
        conversationId = newConv.id;

        // Add initial message
        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
          senderId: auth.currentUser.uid,
          text: 'Olá! Gostaria de oferecer ajuda com seu pet.',
          createdAt: serverTimestamp(),
        });
      }

      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 mb-6 border border-gray-50"
    >
      <Link to={`/pet/${pet.id}`} className="relative aspect-[4/3] block overflow-hidden">
        <motion.img 
          layoutId={`pet-image-${pet.id}`}
          src={pet.photos[0] || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600'} 
          className="w-full h-full object-cover" 
          alt={pet.name} 
        />
        <div className={`absolute top-4 left-4 px-3 py-1 rounded-lg font-extrabold text-[10px] uppercase tracking-wider text-white ${
          isPerdido ? 'bg-perdido' : isEncontrado ? 'bg-encontrado' : isAvistado ? 'bg-accent' : 'bg-gray-400'
        }`}>
          {pet.status}
        </div>
        
        {pet.hasReward && (
          <div className="absolute top-4 right-4 bg-secondary text-white px-3 py-1 rounded-lg font-extrabold text-[10px] uppercase tracking-wider shadow-lg">
            Recompensa
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <Link to={`/pet/${pet.id}`}>
            <h3 className="text-xl font-extrabold text-gray-900 leading-tight">{pet.name || 'Sem nome'}</h3>
            <p className="text-accent font-bold text-sm">
              {pet.breed || 'Raça não informada'} • {pet.species === 'cao' ? 'Cão' : 'Gato'}
            </p>
          </Link>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            HÁ {formatDistanceToNow(pet.createdAt.toDate(), { locale: ptBR, addSuffix: false }).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-500 mb-4">
          <MapPin size={16} className="text-primary" />
          <span className="text-xs font-bold leading-tight">
            {isPerdido ? 'Visto por último: ' : 'Localizado em: '} 
            <span className="text-gray-800">{pet.lastSeenNeighborhood || 'Bairro não informado'}</span>
          </span>
        </div>

        <p className="text-gray-500 text-sm line-clamp-2 mb-6 leading-relaxed">
          {pet.description}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {isPerdido ? (
            <button 
              onClick={() => onAction?.('sighting')}
              className="bg-primary text-white py-3 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              <Eye size={18} />
              EU VI ESSE PET!
            </button>
          ) : (
            <button 
              onClick={() => onAction?.('contact')}
              className="bg-primary text-white py-3 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              <MessageCircle size={18} />
              É MEU / DONO
            </button>
          )}

          <button 
            onClick={handleShare}
            className="bg-blue-50 text-blue-600 py-3 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
          >
            <Share2 size={18} />
            COMPARTILHAR
          </button>

          <button 
            onClick={handleOfferHelp}
            className="bg-accent/10 text-accent py-3 rounded-2xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
          >
            <Heart size={18} />
            OFRECER AJUDA
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PetCard;

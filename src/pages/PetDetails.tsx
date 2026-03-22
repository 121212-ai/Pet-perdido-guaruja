import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, increment, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PetListing, Sighting } from '../types';
import { 
  ChevronLeft, MapPin, Calendar, Tag, MessageCircle, Share2, Heart, 
  AlertCircle, Send, Eye, Camera, Play, CheckCircle2, Edit3, 
  MoreHorizontal, Users, DollarSign, Info, ChevronRight, ExternalLink,
  Navigation, X, Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { GeoPoint, orderBy } from 'firebase/firestore';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const PetDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pet, setPet] = useState<PetListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSightingModal, setShowSightingModal] = useState(false);
  const [sightingInfo, setSightingInfo] = useState('');
  const [sightingPhoto, setSightingPhoto] = useState<string | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showFullscreenGallery, setShowFullscreenGallery] = useState(false);
  const [uploadingSightingPhoto, setUploadingSightingPhoto] = useState(false);
  const [reportingSighting, setReportingSighting] = useState(false);
  const [selectedSightingForMap, setSelectedSightingForMap] = useState<Sighting | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPet = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'pets', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const petData = { id: docSnap.id, ...docSnap.data() } as PetListing;
          setPet(petData);
          
          // Increment view count
          await updateDoc(docRef, {
            viewCount: increment(1)
          });
        }
      } catch (error) {
        console.error('Error fetching pet:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPet();

    // Real-time sightings
    const sightingsQuery = query(
      collection(db, 'sightings'),
      where('petId', '==', id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeSightings = onSnapshot(sightingsQuery, (snapshot) => {
      const sightingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sighting));
      setSightings(sightingsData);
    });

    // Check if following
    if (auth.currentUser && id) {
      const followQuery = query(
        collection(db, 'pet_followers'),
        where('petId', '==', id),
        where('userId', '==', auth.currentUser.uid)
      );
      getDocs(followQuery).then(snap => setIsFollowing(!snap.empty));
    }

    // Follower count
    const countQuery = query(collection(db, 'pet_followers'), where('petId', '==', id));
    const unsubscribeFollowers = onSnapshot(countQuery, (snapshot) => {
      setFollowerCount(snapshot.size);
    });

    return () => {
      unsubscribeSightings();
      unsubscribeFollowers();
    };
  }, [id]);

  const handleToggleFollow = async () => {
    if (!auth.currentUser || !id) {
      navigate('/auth');
      return;
    }

    try {
      if (isFollowing) {
        const q = query(
          collection(db, 'pet_followers'),
          where('petId', '==', id),
          where('userId', '==', auth.currentUser.uid)
        );
        const snap = await getDocs(q);
        snap.forEach(async (d) => await deleteDoc(doc(db, 'pet_followers', d.id)));
        setIsFollowing(false);
      } else {
        await addDoc(collection(db, 'pet_followers'), {
          petId: id,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleOfferHelp = async () => {
    if (!auth.currentUser || !pet) {
      navigate('/auth');
      return;
    }

    if (auth.currentUser.uid === pet.ownerId) {
      alert('Você é o dono deste pet!');
      return;
    }

    try {
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
        const newConv = await addDoc(collection(db, 'conversations'), {
          participants: [auth.currentUser.uid, pet.ownerId],
          petId: pet.id,
          petName: pet.name,
          petPhoto: pet.photos[0],
          lastMessage: 'Olá! Gostaria de oferecer ajuda com seu pet.',
          lastMessageAt: serverTimestamp(),
          unreadCount: 1,
          createdAt: serverTimestamp(),
          status: 'ativo',
          rewardPaid: false
        });
        conversationId = newConv.id;

        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
          senderId: auth.currentUser.uid,
          text: 'Olá! Gostaria de oferecer ajuda com seu pet.',
          type: 'text',
          createdAt: serverTimestamp(),
          read: false
        });
      }

      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setUploadingSightingPhoto(true);
    try {
      const storageRef = ref(storage, `sightings/${id}/${auth.currentUser.uid}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Error uploading photo:', error);
          setUploadingSightingPhoto(false);
          alert('Erro ao fazer upload da foto. Tente novamente.');
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setSightingPhoto(downloadURL);
          setUploadingSightingPhoto(false);
        }
      );
    } catch (error) {
      console.error('Error in photo upload process:', error);
      setUploadingSightingPhoto(false);
    }
  };

  const handleReportSighting = async () => {
    if (!auth.currentUser || !id || !sightingInfo.trim()) return;

    setReportingSighting(true);
    try {
      // Get current location if possible, otherwise use pet's last seen as fallback
      let sightingLocation = pet?.lastSeenLocation;
      
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          sightingLocation = new GeoPoint(position.coords.latitude, position.coords.longitude);
        } catch (geoError) {
          console.warn('Could not get current location, using fallback:', geoError);
        }
      }

      await addDoc(collection(db, 'sightings'), {
        petId: id,
        reporterId: auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || 'Usuário',
        description: sightingInfo,
        photos: sightingPhoto ? [sightingPhoto] : [],
        createdAt: serverTimestamp(),
        confirmed: false,
        location: sightingLocation
      });

      // Also create a notification for the owner
      if (pet?.ownerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: pet.ownerId,
          title: 'Novo avistamento!',
          message: `Alguém viu o pet "${pet.name}"! Confira os detalhes.`,
          type: 'sighting',
          petId: id,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      alert('Avistamento reportado com sucesso!');
      setShowSightingModal(false);
      setSightingInfo('');
      setSightingPhoto(null);
    } catch (error) {
      console.error('Error reporting sighting:', error);
      alert('Erro ao reportar avistamento. Tente novamente.');
    } finally {
      setReportingSighting(false);
    }
  };

  const handleMarkAsFound = async () => {
    if (!pet || !id) return;
    if (!window.confirm('Confirmar que seu pet foi encontrado? Isso atualizará o status do anúncio.')) return;

    try {
      await updateDoc(doc(db, 'pets', id), {
        status: 'encontrado',
        updatedAt: serverTimestamp()
      });
      setPet({ ...pet, status: 'encontrado' });
      
      // Notify followers
      const followersSnap = await getDocs(query(collection(db, 'pet_followers'), where('petId', '==', id)));
      followersSnap.forEach(async (f) => {
        const followerId = f.data().userId;
        if (followerId !== auth.currentUser?.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: followerId,
            title: 'Pet Encontrado! 🎉',
            message: `Boas notícias! O pet "${pet.name}" que você estava seguindo foi encontrado.`,
            type: 'status_update',
            petId: id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      });

      alert('Parabéns! Ficamos felizes que seu pet foi encontrado.');
    } catch (error) {
      console.error('Error marking as found:', error);
    }
  };

  const handleShare = async () => {
    if (!pet) return;
    try {
      await navigator.share({
        title: `Pet ${pet.status === 'perdido' ? 'Perdido' : 'Encontrado'}: ${pet.name}`,
        text: `${pet.name} está ${pet.status} em ${pet.lastSeenNeighborhood}. Ajude a encontrá-lo!`,
        url: window.location.href,
      });
      await updateDoc(doc(db, 'pets', pet.id), {
        shareCount: increment(1)
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openInGoogleMaps = () => {
    if (!pet?.lastSeenLocation) return;
    const { latitude, longitude } = pet.lastSeenLocation;
    window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isOwner = auth.currentUser?.uid === pet.ownerId;

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header Image Gallery */}
      <div className="relative h-[50vh] w-full bg-gray-900 group">
        <div 
          ref={galleryRef}
          className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => {
            const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth);
            setCurrentPhotoIndex(index);
          }}
        >
          {pet.photos.map((photo, index) => (
            <div 
              key={index} 
              className="min-w-full h-full snap-center relative cursor-pointer"
              onClick={() => setShowFullscreenGallery(true)}
            >
              <motion.img 
                layoutId={index === 0 ? `pet-image-${pet.id}` : undefined}
                src={photo} 
                className="w-full h-full object-cover"
                alt={`${pet.name} - ${index + 1}`}
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
          {pet.videoURL && (
            <div className="min-w-full h-full snap-center bg-black flex items-center justify-center relative">
              <video 
                src={pet.videoURL} 
                className="w-full h-full object-contain"
                controls={false}
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={64} className="text-white opacity-80" />
              </div>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-bold">
                VÍDEO DISPONÍVEL
              </div>
            </div>
          )}
        </div>

        {/* Gallery Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {pet.photos.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentPhotoIndex === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
              }`} 
            />
          ))}
          {pet.videoURL && (
            <div className={`h-1.5 rounded-full transition-all duration-300 ${
              currentPhotoIndex === pet.photos.length ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
            }`} />
          )}
        </div>

        {/* Top Controls */}
        <div className="absolute top-12 left-6 right-6 flex justify-between items-center z-10">
          <button 
            onClick={() => navigate(-1)}
            className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-lg active:scale-95 transition-transform"
            >
              <Share2 size={24} className="text-gray-900" />
            </button>
            {isOwner && (
              <button 
                onClick={() => navigate(`/edit/${pet.id}`)}
                className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-lg active:scale-95 transition-transform"
              >
                <Edit3 size={24} className="text-primary" />
              </button>
            )}
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-32 left-6">
          <span className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl flex items-center gap-2 ${
            pet.status === 'perdido' ? 'bg-perdido' : pet.status === 'encontrado' ? 'bg-encontrado' : 'bg-accent'
          }`}>
            <AlertCircle size={14} />
            {pet.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-10 relative z-20 bg-white rounded-t-[40px] pt-10">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-black text-gray-900 mb-2 leading-tight">{pet.name || 'Sem nome'}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-primary/10">
                {pet.breed || 'Vira-lata'}
              </span>
              <span className="bg-accent/5 text-accent text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-accent/10">
                {pet.species === 'cao' ? 'Cachorro' : 'Gato'}
              </span>
              <span className="bg-secondary/5 text-secondary text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-secondary/10">
                {pet.age || 'Idade não inf.'}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Eye size={16} />
              <span className="text-xs font-bold">{pet.viewCount || 0}</span>
            </div>
            <button 
              onClick={handleToggleFollow}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                isFollowing 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Heart size={14} fill={isFollowing ? 'currentColor' : 'none'} />
              {isFollowing ? 'Seguindo' : 'Seguir'}
            </button>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Users size={14} />
              <span className="text-[10px] font-bold">{followerCount} seguindo</span>
            </div>
          </div>
        </div>

        {/* Reward Card */}
        {pet.hasReward && pet.status === 'perdido' && (
          <div className="bg-secondary/5 border-2 border-secondary/20 rounded-[32px] p-6 mb-8 flex items-center justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-secondary/10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <DollarSign size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-secondary text-[10px] font-black uppercase tracking-widest mb-1">Recompensa Oferecida</p>
              <h2 className="text-3xl font-black text-secondary leading-none">
                R$ {pet.rewardAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div className="bg-secondary p-4 rounded-2xl text-white shadow-lg shadow-secondary/20 relative z-10">
              <DollarSign size={24} />
            </div>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Tag size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Porte</span>
            </div>
            <p className="text-sm font-bold text-gray-800 capitalize">{pet.size}</p>
          </div>
          <div className="bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-2 text-accent mb-2">
              <div className="w-4 h-4 rounded-full border-2 border-accent" style={{ backgroundColor: pet.color }} />
              <span className="text-[10px] font-black uppercase tracking-widest">Cor</span>
            </div>
            <p className="text-sm font-bold text-gray-800">{pet.color || 'Não informada'}</p>
          </div>
          <div className="bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-2 text-secondary mb-2">
              <Info size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Microchip</span>
            </div>
            <p className="text-sm font-bold text-gray-800">
              {pet.hasMicrochip ? `Sim: ${pet.microchipCode}` : 'Não informado'}
            </p>
          </div>
          <div className="bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-2 text-perdido mb-2">
              <Calendar size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Visto em</span>
            </div>
            <p className="text-sm font-bold text-gray-800">
              {pet.lostDate ? format(pet.lostDate.toDate(), "dd/MM/yyyy") : format(pet.createdAt.toDate(), "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-10">
          <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
            Sobre o {pet.name}
          </h3>
          <p className="text-gray-600 leading-relaxed text-base">
            {pet.description}
          </p>
        </div>

        {/* Last Seen Map */}
        <div className="mb-10">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xl font-black text-gray-900">Última vez visto</h3>
            <p className="text-[10px] font-black text-perdido uppercase tracking-widest">{pet.lastSeenNeighborhood}</p>
          </div>
          
          <div className="bg-gray-50 rounded-[40px] p-2 border border-gray-100 overflow-hidden shadow-inner">
            <div className="h-64 w-full rounded-[32px] overflow-hidden relative">
              {pet.lastSeenLocation && (
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map
                    defaultCenter={{ lat: pet.lastSeenLocation.latitude, lng: pet.lastSeenLocation.longitude }}
                    defaultZoom={15}
                    mapId="PET_DETAIL_MAP"
                    disableDefaultUI={true}
                    gestureHandling="none"
                  >
                    <AdvancedMarker position={{ lat: pet.lastSeenLocation.latitude, lng: pet.lastSeenLocation.longitude }}>
                      <Pin background="#FF6321" borderColor="#fff" glyphColor="#fff" />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="bg-perdido/10 p-2 rounded-xl">
                  <MapPin size={20} className="text-perdido" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 leading-tight mb-1">{pet.lastSeenAddress}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guarujá, SP</p>
                </div>
              </div>
              <button 
                onClick={openInGoogleMaps}
                className="w-full bg-white border-2 border-gray-100 text-gray-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
              >
                <Navigation size={18} />
                Abrir no Google Maps
              </button>
            </div>
          </div>
        </div>

        {/* Community Updates (Sightings) */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              Atualizações da Comunidade
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{sightings.length}</span>
            </h3>
          </div>

          <div className="space-y-4">
            {sightings.length === 0 ? (
              <div className="bg-gray-50 rounded-[32px] p-8 text-center border border-dashed border-gray-200">
                <Camera size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Nenhum avistamento ainda</p>
              </div>
            ) : (
              sightings.map((sighting) => (
                <div key={sighting.id} className="bg-white border border-gray-100 rounded-[32px] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-black text-sm">
                      {sighting.reporterName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900">{sighting.reporterName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {formatDistanceToNow(sighting.createdAt.toDate(), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                    {sighting.confirmed && (
                      <span className="bg-green-100 text-green-600 p-1 rounded-full">
                        <CheckCircle2 size={14} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">{sighting.description}</p>
                  {sighting.photos && sighting.photos.length > 0 && (
                    <div className="mb-4 rounded-2xl overflow-hidden h-40">
                      <img src={sighting.photos[0]} className="w-full h-full object-cover" alt="Sighting" />
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedSightingForMap(sighting)}
                    className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    Ver no mapa <ChevronRight size={12} />
                  </button>
                </div>
              ))
            )}
            
            <button 
              onClick={() => setShowSightingModal(true)}
              className="w-full border-2 border-dashed border-gray-200 rounded-[32px] py-6 flex flex-col items-center gap-2 text-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Camera size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Adicionar observação ou foto</span>
            </button>
          </div>
        </div>

        {/* Owner Info */}
        <div className="bg-gray-50 rounded-[40px] p-8 mb-10 text-center border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Postado por</p>
          <div className="w-24 h-24 bg-white rounded-[32px] mx-auto p-1 shadow-xl mb-4">
            <img 
              src={pet.ownerPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pet.ownerId}`} 
              className="w-full h-full object-cover rounded-[28px]" 
              alt={pet.ownerName} 
            />
          </div>
          <h4 className="text-xl font-black text-gray-900 mb-1">{pet.ownerName}</h4>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
            Membro desde {format(pet.createdAt.toDate(), "yyyy")}
          </p>
          {!isOwner && (
            <button 
              onClick={handleOfferHelp}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform"
            >
              Contatar Dono
            </button>
          )}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex gap-4 z-50 safe-area-bottom">
        {isOwner ? (
          <>
            <button 
              onClick={handleMarkAsFound}
              disabled={pet.status === 'encontrado'}
              className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-green-500/20 active:scale-95 transition-transform disabled:opacity-50"
            >
              <CheckCircle2 size={20} />
              MEU PET FOI ENCONTRADO!
            </button>
            <button 
              onClick={() => navigate(`/edit/${pet.id}`)}
              className="bg-gray-100 text-gray-900 p-4 rounded-2xl active:scale-95 transition-transform"
            >
              <Edit3 size={24} />
            </button>
          </>
        ) : (
          <>
            {pet.status === 'perdido' && (
              <button 
                onClick={() => setShowSightingModal(true)}
                className="flex-1 bg-perdido text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-perdido/20 active:scale-95 transition-transform"
              >
                <Eye size={20} />
                EU VI ESSE PET!
              </button>
            )}
            <button 
              onClick={handleOfferHelp}
              className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-transform"
            >
              <MessageCircle size={20} />
              CONTATAR DONO
            </button>
          </>
        )}
      </div>

      {/* Sighting Modal */}
      <AnimatePresence>
        {showSightingModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSightingModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setShowSightingModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
              <h2 className="text-3xl font-black text-gray-900 mb-2">Reportar Avistamento</h2>
              <p className="text-gray-500 mb-8 font-bold">Onde e como você viu o {pet.name}?</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Descrição do Avistamento</label>
                  <textarea 
                    value={sightingInfo}
                    onChange={(e) => setSightingInfo(e.target.value)}
                    placeholder="Ex: Vi ele correndo perto da padaria na Rua X há 10 minutos. Parecia assustado..."
                    className="w-full h-32 bg-gray-50 rounded-3xl p-5 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 border border-gray-100 resize-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Adicionar Foto (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                  {sightingPhoto ? (
                    <div className="relative w-full h-40 rounded-3xl overflow-hidden border border-gray-100">
                      <img src={sightingPhoto} className="w-full h-full object-cover" alt="Sighting preview" />
                      <button 
                        onClick={() => setSightingPhoto(null)}
                        className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:bg-black/70 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-40 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      {uploadingSightingPhoto ? (
                        <Loader2 size={32} className="animate-spin text-primary" />
                      ) : (
                        <>
                          <Camera size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Tirar ou escolher foto</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
                  <Info size={20} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700 leading-tight">
                    Sua localização atual será enviada junto com o relato para ajudar o dono a localizar o pet.
                  </p>
                </div>

                <button 
                  onClick={handleReportSighting}
                  disabled={!sightingInfo.trim() || reportingSighting || uploadingSightingPhoto}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {reportingSighting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                  {reportingSighting ? 'ENVIANDO...' : 'ENVIAR INFORMAÇÃO'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Gallery */}
      <AnimatePresence>
        {showFullscreenGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            <div className="absolute top-12 right-6 z-10 flex gap-2">
              <button 
                onClick={() => setShowFullscreenGallery(false)}
                className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white active:scale-95 transition-transform hover:bg-white/30"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4">
              {currentPhotoIndex < pet.photos.length ? (
                <img 
                  src={pet.photos[currentPhotoIndex]} 
                  className="w-full h-auto max-h-full object-contain rounded-2xl"
                  alt="Fullscreen"
                  referrerPolicy="no-referrer"
                />
              ) : pet.videoURL ? (
                <video 
                  src={pet.videoURL} 
                  className="w-full h-auto max-h-full object-contain rounded-2xl"
                  controls
                  autoPlay
                />
              ) : null}
            </div>

            <div className="p-10 flex justify-center gap-4 overflow-x-auto no-scrollbar">
              {pet.photos.map((photo, i) => (
                <div 
                  key={i}
                  onClick={() => setCurrentPhotoIndex(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    currentPhotoIndex === i ? 'border-primary scale-110' : 'border-transparent opacity-50'
                  }`}
                >
                  <img src={photo} className="w-full h-full object-cover" alt="thumb" referrerPolicy="no-referrer" />
                </div>
              ))}
              {pet.videoURL && (
                <div 
                  onClick={() => setCurrentPhotoIndex(pet.photos.length)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-gray-800 flex items-center justify-center ${
                    currentPhotoIndex === pet.photos.length ? 'border-primary scale-110' : 'border-transparent opacity-50'
                  }`}
                >
                  <Play size={24} className="text-white" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sighting Map Modal */}
      <AnimatePresence>
        {selectedSightingForMap && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSightingForMap(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="h-96 w-full relative">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map
                    defaultCenter={{ lat: selectedSightingForMap.location.latitude, lng: selectedSightingForMap.location.longitude }}
                    defaultZoom={16}
                    mapId="SIGHTING_DETAIL_MAP"
                  >
                    <AdvancedMarker position={{ lat: selectedSightingForMap.location.latitude, lng: selectedSightingForMap.location.longitude }}>
                      <Pin background="#FF6321" borderColor="#fff" glyphColor="#fff" />
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
                <button 
                  onClick={() => setSelectedSightingForMap(null)}
                  className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full text-gray-900 shadow-lg hover:bg-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black">
                    {selectedSightingForMap.reporterName[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 leading-none mb-1">{selectedSightingForMap.reporterName}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {formatDistanceToNow(selectedSightingForMap.createdAt.toDate(), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed mb-6">{selectedSightingForMap.description}</p>
                <button 
                  onClick={() => {
                    const { latitude, longitude } = selectedSightingForMap.location;
                    window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, '_blank');
                  }}
                  className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Navigation size={18} />
                  Abrir no Google Maps
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PetDetailsPage;

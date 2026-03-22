import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PetListing, Reward, UserProfile, Review, Sighting } from '../types';
import { 
  User, Settings, LogOut, ChevronRight, MapPin, Phone, Mail, Edit2, 
  Heart, AlertCircle, Loader2, DollarSign, Clock, CheckCircle2, 
  RotateCcw, Star, Award, Trash2, Camera, X, MessageSquare, ShieldCheck
} from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ProfilePage: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [userPets, setUserPets] = useState<PetListing[]>([]);
  const [helpedPets, setHelpedPets] = useState<PetListing[]>([]);
  const [userRewards, setUserRewards] = useState<Reward[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pets' | 'helped' | 'reviews'>('pets');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    neighborhood: '',
    photoURL: ''
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkExpiredRewards = async () => {
      if (!user) return;
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const q = query(
        collection(db, 'rewards'),
        where('ownerId', '==', user.uid),
        where('status', '==', 'escrow'),
        where('createdAt', '<=', sevenDaysAgo)
      );
      
      const snapshot = await getDocs(q);
      snapshot.forEach(async (rewardDoc) => {
        await updateDoc(doc(db, 'rewards', rewardDoc.id), {
          status: 'refunded',
          refundedAt: serverTimestamp()
        });
      });
    };
    
    checkExpiredRewards();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch user document
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setUserData(data);
          setEditForm({
            name: data.name || '',
            phone: data.phone || '',
            neighborhood: data.neighborhood || '',
            photoURL: data.photoURL || ''
          });
        }

        // Fetch user's pets
        const qPets = query(collection(db, 'pets'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
        const petsSnapshot = await getDocs(qPets);
        setUserPets(petsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PetListing)));

        // Fetch pets user helped (where finderId == user.uid)
        const qHelped = query(collection(db, 'pets'), where('finderId', '==', user.uid));
        const helpedSnapshot = await getDocs(qHelped);
        setHelpedPets(helpedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PetListing)));

        // Fetch user's rewards
        const qRewards = query(collection(db, 'rewards'), where('ownerId', '==', user.uid));
        const rewardsSnapshot = await getDocs(qRewards);
        setUserRewards(rewardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward)));

        // Fetch reviews
        const qReviews = query(collection(db, 'reviews'), where('targetUserId', '==', user.uid), orderBy('createdAt', 'desc'));
        const reviewsSnapshot = await getDocs(qReviews);
        setReviews(reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));

      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/welcome');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Tem certeza que deseja excluir sua conta? Esta ação é irreversível.')) return;
    try {
      // In a real app, we would delete all user data here
      await deleteDoc(doc(db, 'users', user!.uid));
      await user?.delete();
      navigate('/welcome');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Para excluir sua conta, você precisa ter feito login recentemente. Por favor, saia e entre novamente.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...editForm,
        updatedAt: serverTimestamp()
      });
      setUserData(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/profile_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditForm(prev => ({ ...prev, photoURL: url }));
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploading(false);
    }
  };

  const getBadgeInfo = () => {
    const count = userData?.petsHelped || 0;
    if (count >= 20) return { label: 'Status Platina', color: 'text-purple-500', bg: 'bg-purple-50', icon: '⭐' };
    if (count >= 5) return { label: 'Herói dos Pets', color: 'text-amber-500', bg: 'bg-amber-50', icon: '🐾' };
    return { label: 'Voluntário', color: 'text-blue-500', bg: 'bg-blue-50', icon: '🤝' };
  };

  const badge = getBadgeInfo();

  if (loading && !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Section */}
      <div className="bg-white px-6 pt-16 pb-8 rounded-b-[40px] shadow-sm relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="relative flex flex-col items-center text-center">
          {/* Profile Photo */}
          <div className={`relative p-1 rounded-full border-2 ${badge.color.replace('text', 'border')}`}>
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
              {userData?.photoURL ? (
                <img src={userData.photoURL} className="w-full h-full object-cover" alt="profile" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                  <User size={40} />
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-2 rounded-full shadow-md border border-gray-100">
              <span className="text-xl">{badge.icon}</span>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-black text-gray-900">{userData?.name || 'Usuário'}</h1>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            <MapPin size={12} className="text-accent" />
            {userData?.neighborhood}, Guarujá
          </div>

          {/* Reputation Stars */}
          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                size={16} 
                className={star <= (userData?.reputation || 0) ? "fill-amber-400 text-amber-400" : "text-gray-200"} 
              />
            ))}
            <span className="text-xs font-black text-gray-400 ml-1">({reviews.length})</span>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-8 mt-6">
            <div className="text-center">
              <p className="text-xl font-black text-gray-900">{userData?.petsHelped || 0}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pets Ajudados</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className={`px-4 py-2 rounded-2xl ${badge.bg} ${badge.color} flex items-center gap-2`}>
              <Award size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{badge.label}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8 w-full">
            <button 
              onClick={() => setIsEditing(true)}
              className="flex-1 bg-primary text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20"
            >
              <Edit2 size={18} />
              EDITAR PERFIL
            </button>
            <button 
              onClick={handleLogout}
              className="bg-gray-100 text-gray-600 p-4 rounded-2xl active:scale-95 transition-transform"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 mt-8">
        <div className="flex bg-white p-1.5 rounded-3xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setActiveTab('pets')}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'pets' ? 'bg-primary text-white shadow-md' : 'text-gray-400'
            }`}
          >
            Meus Pets
          </button>
          <button 
            onClick={() => setActiveTab('helped')}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'helped' ? 'bg-primary text-white shadow-md' : 'text-gray-400'
            }`}
          >
            Ajudados
          </button>
          <button 
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'reviews' ? 'bg-primary text-white shadow-md' : 'text-gray-400'
            }`}
          >
            Avaliações
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 mt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'pets' && (
            <motion.div 
              key="pets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {userPets.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                  <Heart size={40} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-gray-400">Você ainda não postou nenhum pet.</p>
                  <button 
                    onClick={() => navigate('/report')}
                    className="mt-4 text-primary font-black text-xs uppercase tracking-widest"
                  >
                    Postar agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {userPets.map(pet => (
                    <div 
                      key={pet.id} 
                      onClick={() => navigate(`/pet/${pet.id}`)}
                      className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 active:scale-95 transition-transform"
                    >
                      <div className="relative h-32">
                        <img src={pet.photos[0]} className="w-full h-full object-cover" alt={pet.name} />
                        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          pet.status === 'perdido' ? 'bg-perdido text-white' : 'bg-encontrado text-white'
                        }`}>
                          {pet.status}
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-black text-gray-900 text-sm truncate">{pet.name || 'Sem nome'}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          {pet.breed}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => navigate('/report')}
                    className="aspect-square bg-primary/5 border-2 border-dashed border-primary/20 rounded-[32px] flex flex-col items-center justify-center gap-2 text-primary active:scale-95 transition-transform"
                  >
                    <div className="bg-primary text-white p-2 rounded-full">
                      <Edit2 size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Novo Pet</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'helped' && (
            <motion.div 
              key="helped"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {helpedPets.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                  <ShieldCheck size={40} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-gray-400">Você ainda não ajudou nenhum pet a voltar para casa.</p>
                </div>
              ) : (
                helpedPets.map(pet => (
                  <div key={pet.id} className="bg-white p-4 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4">
                    <img src={pet.photos[0]} className="w-16 h-16 object-cover rounded-2xl" alt={pet.name} />
                    <div className="flex-1">
                      <h4 className="font-black text-gray-900 text-sm">{pet.name}</h4>
                      <p className="text-[10px] font-bold text-encontrado uppercase tracking-widest mt-1">
                        Encontrado em {pet.updatedAt ? format(pet.updatedAt.toDate(), "dd/MM/yyyy") : '---'}
                      </p>
                      {pet.hasReward && (
                        <div className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-full mt-2">
                          <DollarSign size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Recompensa Recebida</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {reviews.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-gray-200">
                  <MessageSquare size={40} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-gray-400">Nenhuma avaliação recebida ainda.</p>
                </div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                        {review.authorPhoto ? (
                          <img src={review.authorPhoto} className="w-full h-full object-cover" alt={review.authorName} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-gray-900 text-xs">{review.authorName}</h4>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={10} className={s <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {format(review.createdAt.toDate(), "dd/MM/yy")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed italic">"{review.comment}"</p>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Account Management */}
      <div className="px-6 mt-12 space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Gerenciar Conta</h3>
        <button 
          onClick={handleDeleteAccount}
          className="w-full bg-white text-perdido py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border border-perdido/20 active:scale-95 transition-transform"
        >
          <Trash2 size={20} />
          EXCLUIR MINHA CONTA
        </button>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Editar Perfil</h2>
                <button onClick={() => setIsEditing(false)} className="bg-gray-100 p-2 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Photo Edit */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                      {editForm.photoURL ? (
                        <img src={editForm.photoURL} className="w-full h-full object-cover" alt="preview" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                          <User size={40} />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white disabled:opacity-50"
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Toque no ícone para alterar a foto</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">Nome Completo</label>
                  <input 
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">Telefone</label>
                  <input 
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                    placeholder="(13) 99999-9999"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-2 block">Bairro em Guarujá</label>
                  <select 
                    value={editForm.neighborhood}
                    onChange={(e) => setEditForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-800 focus:ring-2 focus:ring-primary/20 transition-shadow"
                  >
                    <option value="">Selecione o bairro</option>
                    <option value="Enseada">Enseada</option>
                    <option value="Pitangueiras">Pitangueiras</option>
                    <option value="Astúrias">Astúrias</option>
                    <option value="Tombo">Tombo</option>
                    <option value="Guaiúba">Guaiúba</option>
                    <option value="Vicente de Carvalho">Vicente de Carvalho</option>
                    <option value="Perequê">Perequê</option>
                    <option value="Santa Cruz dos Navegantes">Santa Cruz dos Navegantes</option>
                  </select>
                </div>

                <button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  SALVAR ALTERAÇÕES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;

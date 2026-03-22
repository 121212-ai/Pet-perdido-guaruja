import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  GeoPoint 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { geohashForLocation } from 'geofire-common';
import imageCompression from 'browser-image-compression';
import { 
  ChevronLeft, 
  Camera, 
  MapPin, 
  Tag, 
  Info, 
  Check, 
  AlertCircle, 
  Loader2, 
  X, 
  Video,
  Calendar as CalendarIcon,
  DollarSign,
  Palette,
  Image as ImageIcon
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const NEIGHBORHOODS = [
  'Enseada', 'Pitangueiras', 'Astúrias', 'Tombo', 'Guaiúba', 
  'Perequê', 'Santa Cruz dos Navegantes', 'Vila Alice', 'Pae Cará',
  'Vicente de Carvalho', 'Morrinhos', 'Jardim Virgínia', 'Pernambuco',
  'Balneário Cidade Atlântica', 'Jardim Acapulco', 'Jardim Las Palmas'
].sort();

const POPULAR_BREEDS = [
  'SRD (Sem Raça Definida)', 'Poodle', 'Pinscher', 'Yorkshire', 'Shih Tzu',
  'Lhasa Apso', 'Golden Retriever', 'Labrador', 'Bulldog Francês', 'Beagle',
  'Dachshund (Salsicha)', 'Pastor Alemão', 'Rottweiler', 'Pitbull', 'Siamês',
  'Persa', 'Maine Coon', 'Angorá', 'Bengal'
].sort();

const PostPetPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const [formData, setFormData] = useState({
    name: '',
    species: 'cao' as 'cao' | 'gato',
    breed: '',
    color: '',
    colorHex: '#000000',
    size: 'medio' as 'pequeno' | 'medio' | 'grande',
    status: 'perdido' as 'perdido' | 'encontrado',
    lastSeenNeighborhood: '',
    lastSeenAddress: '',
    description: '',
    lostDate: new Date().toISOString().split('T')[0],
    hasReward: false,
    rewardAmount: '',
    location: null as { lat: number, lng: number } | null,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showBottomSheet, setShowBottomSheet] = useState<'image' | 'video' | null>(null);
  const [media, setMedia] = useState<{ file: File, type: 'image' | 'video', preview: string, id: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files) return;

    const newMedia: { file: File, type: 'image' | 'video', preview: string, id: string }[] = [];

    for (const file of Array.from(files)) {
      if (type === 'image') {
        if (media.filter(m => m.type === 'image').length + newMedia.length >= 6) {
          alert('Limite de 6 fotos atingido.');
          break;
        }

        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await (imageCompression as any)(file, options) as File;
          newMedia.push({
            file: compressedFile,
            type: 'image',
            preview: URL.createObjectURL(compressedFile as Blob),
            id: Math.random().toString(36).substring(7)
          });
        } catch (error) {
          console.error('Compression error:', error);
          newMedia.push({
            file: file as File,
            type: 'image',
            preview: URL.createObjectURL(file as Blob),
            id: Math.random().toString(36).substring(7)
          });
        }
      } else {
        if (media.filter(m => m.type === 'video').length >= 1) {
          alert('Limite de 1 vídeo atingido.');
          break;
        }

        // Check video duration (60s limit)
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          if (video.duration > 60) {
            alert('O vídeo deve ter no máximo 60 segundos.');
            return;
          }
          setMedia(prev => [...prev, {
            file: file as File,
            type: 'video',
            preview: URL.createObjectURL(file as Blob),
            id: Math.random().toString(36).substring(7)
          }]);
        };
        video.src = URL.createObjectURL(file as Blob);
        continue; // Handled in callback
      }
    }

    if (newMedia.length > 0) {
      setMedia(prev => [...prev, ...newMedia]);
    }
    setShowBottomSheet(null);
  };

  const removeMedia = (id: string) => {
    setMedia(prev => {
      const item = prev.find(m => m.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(m => m.id !== id);
    });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setFormData(prev => ({ ...prev, location: loc }));
        reverseGeocode(loc);
      }, (error) => {
        console.error("Error getting location:", error);
        alert("Não foi possível obter sua localização atual.");
      });
    }
  };

  const reverseGeocode = async (loc: { lat: number, lng: number }) => {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=${API_KEY}`);
      const data = await response.json();
      if (data.results && data.results[0]) {
        setFormData(prev => ({ ...prev, lastSeenAddress: data.results[0].formatted_address }));
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  };

  const uploadMedia = async (petId: string) => {
    const urls: string[] = [];
    let videoUrl = '';

    for (const item of media) {
      const storageRef = ref(storage, `pets/${petId}/${item.type}s/${item.id}_${item.file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, item.file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(prev => ({ ...prev, [item.id]: progress }));
          }, 
          (error) => reject(error), 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (item.type === 'image') urls.push(downloadURL);
            else videoUrl = downloadURL;
            resolve();
          }
        );
      });
    }

    return { urls, videoUrl };
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      alert('Você precisa estar logado para postar.');
      return;
    }

    if (formData.name.length < 2) {
      alert('Nome do pet deve ter pelo menos 2 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const petId = Math.random().toString(36).substring(7); // Temporary ID for storage path
      const { urls, videoUrl } = await uploadMedia(petId);

      const petData: any = {
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        color: formData.color,
        size: formData.size,
        status: formData.status,
        lastSeenNeighborhood: formData.lastSeenNeighborhood,
        lastSeenAddress: formData.lastSeenAddress,
        description: formData.description,
        lostDate: new Date(formData.lostDate),
        hasReward: formData.hasReward,
        rewardAmount: formData.hasReward ? parseFloat(formData.rewardAmount.replace(/\D/g, '')) / 100 : 0,
        photos: urls,
        videoURL: videoUrl,
        ownerId: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || 'Usuário',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (formData.location) {
        petData.lastSeenLocation = new GeoPoint(formData.location.lat, formData.location.lng);
        petData.geohash = geohashForLocation([formData.location.lat, formData.location.lng]);
      }

      const docRef = await addDoc(collection(db, 'pets'), petData);

      alert('Alerta publicado! A comunidade foi notificada 🐾');
      navigate(`/pet/${docRef.id}`);
    } catch (error) {
      console.error('Error posting pet:', error);
      alert('Erro ao publicar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (currentStep: number) => {
    const newErrors: { [key: string]: string } = {};

    if (currentStep === 1) {
      if (formData.name.length < 2) newErrors.name = 'Nome deve ter pelo menos 2 caracteres.';
      if (!formData.breed) newErrors.breed = 'Raça é obrigatória.';
      if (!formData.color) newErrors.color = 'Cor é obrigatória.';
    } else if (currentStep === 2) {
      if (!formData.lastSeenNeighborhood) newErrors.neighborhood = 'Bairro é obrigatório.';
      if (!formData.location) newErrors.location = 'Selecione a localização no mapa.';
    } else if (currentStep === 3) {
      if (media.filter(m => m.type === 'image').length === 0) newErrors.media = 'Pelo menos uma foto é obrigatória.';
      if (!formData.description) newErrors.description = 'Descrição é obrigatória.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(s => s + 1);
    }
  };
  const prevStep = () => setStep(s => s - 1);

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const amount = parseInt(numericValue) / 100;
    if (isNaN(amount)) return '';
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-50 border-b border-gray-50">
        <button onClick={() => step > 1 ? prevStep() : navigate(-1)} className="p-2 -ml-2 text-gray-900 active:scale-95 transition-transform">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-xl font-black text-gray-900">Reportar Pet</h1>
        <div className="w-10" />
      </div>

      {/* Progress Bar */}
      <div className="px-6 mb-8">
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(step / 4) * 100}%` }}
            className="h-full bg-primary"
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Passo {step} de 4</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {step === 1 ? 'Informações Básicas' : step === 2 ? 'Localização' : step === 3 ? 'Mídia' : 'Recompensa e Finalização'}
          </span>
        </div>
      </div>

      <div className="px-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Status do Pet</label>
                <div className="grid grid-cols-2 gap-3">
                  {['perdido', 'encontrado'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFormData({ ...formData, status: s as any })}
                      className={`py-4 rounded-2xl font-black text-sm uppercase tracking-wider border-2 transition-all ${
                        formData.status === s 
                          ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                          : 'bg-white border-gray-100 text-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Espécie</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'cao', label: '🐕 Cachorro' },
                    { id: 'gato', label: '🐈 Gato' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setFormData({ ...formData, species: s.id as any })}
                      className={`py-4 rounded-2xl font-black text-sm uppercase tracking-wider border-2 transition-all ${
                        formData.species === s.id 
                          ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' 
                          : 'bg-white border-gray-100 text-gray-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Nome do Pet</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (e.target.value.length >= 2) setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="Ex: Totó, Mel, etc."
                  className={`w-full bg-gray-50 rounded-2xl p-4 text-gray-800 placeholder:text-gray-400 focus:outline-none border font-bold transition-colors ${
                    errors.name ? 'border-red-500' : 'border-gray-100'
                  }`}
                />
                {errors.name && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.name}</p>}
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Raça</label>
                <div className="relative">
                  <input 
                    type="text"
                    list="breeds"
                    value={formData.breed}
                    onChange={(e) => {
                      setFormData({ ...formData, breed: e.target.value });
                      if (e.target.value) setErrors(prev => ({ ...prev, breed: '' }));
                    }}
                    placeholder="Ex: Poodle, SRD, etc."
                    className={`w-full bg-gray-50 rounded-2xl p-4 text-gray-800 placeholder:text-gray-400 focus:outline-none border font-bold transition-colors ${
                      errors.breed ? 'border-red-500' : 'border-gray-100'
                    }`}
                  />
                  <datalist id="breeds">
                    {POPULAR_BREEDS.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                {errors.breed && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.breed}</p>}
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Cor Principal</label>
                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={formData.color}
                    onChange={(e) => {
                      setFormData({ ...formData, color: e.target.value });
                      if (e.target.value) setErrors(prev => ({ ...prev, color: '' }));
                    }}
                    placeholder="Ex: Caramelo, Preto..."
                    className={`flex-1 bg-gray-50 rounded-2xl p-4 text-gray-800 placeholder:text-gray-400 focus:outline-none border font-bold transition-colors ${
                      errors.color ? 'border-red-500' : 'border-gray-100'
                    }`}
                  />
                  <div className="relative w-14 h-14 shrink-0">
                    <input 
                      type="color"
                      value={formData.colorHex}
                      onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div 
                      className="w-full h-full rounded-2xl border-2 border-white shadow-sm"
                      style={{ backgroundColor: formData.colorHex }}
                    />
                  </div>
                </div>
                {errors.color && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.color}</p>}
              </div>

              <div className="mb-8">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Porte</label>
                <div className="flex gap-2">
                  {['pequeno', 'medio', 'grande'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFormData({ ...formData, size: s as any })}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all ${
                        formData.size === s 
                          ? 'bg-gray-900 border-gray-900 text-white' 
                          : 'bg-white border-gray-100 text-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={nextStep}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-95 transition-transform"
              >
                PRÓXIMO PASSO
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Bairro (Guarujá)</label>
                <select 
                  value={formData.lastSeenNeighborhood}
                  onChange={(e) => {
                    setFormData({ ...formData, lastSeenNeighborhood: e.target.value });
                    if (e.target.value) setErrors(prev => ({ ...prev, neighborhood: '' }));
                  }}
                  className={`w-full bg-gray-50 rounded-2xl p-4 text-gray-800 focus:outline-none border font-bold appearance-none transition-colors ${
                    errors.neighborhood ? 'border-red-500' : 'border-gray-100'
                  }`}
                >
                  <option value="">Selecione o bairro</option>
                  {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {errors.neighborhood && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.neighborhood}</p>}
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Data do Desaparecimento</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.lostDate}
                    onChange={(e) => setFormData({ ...formData, lostDate: e.target.value })}
                    className="w-full bg-gray-50 rounded-2xl p-4 pl-12 text-gray-800 focus:outline-none border border-gray-100 font-bold"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Localização no Mapa</label>
                <button 
                  onClick={handleGetLocation}
                  className="w-full py-4 mb-4 rounded-2xl bg-primary/10 text-primary font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <MapPin size={20} />
                  Usar minha localização atual
                </button>

                <div className={`h-48 rounded-2xl overflow-hidden border mb-4 transition-colors ${
                  errors.location ? 'border-red-500' : 'border-gray-100'
                }`}>
                  <APIProvider apiKey={API_KEY}>
                    <Map
                      defaultCenter={formData.location || { lat: -23.9935, lng: -46.2568 }}
                      defaultZoom={13}
                      mapId="PET_REPORT_MAP"
                      onClick={(e) => {
                        if (e.detail.latLng) {
                          setFormData(prev => ({ ...prev, location: e.detail.latLng }));
                          setErrors(prev => ({ ...prev, location: '' }));
                          reverseGeocode(e.detail.latLng);
                        }
                      }}
                    >
                      {formData.location && (
                        <AdvancedMarker position={formData.location} />
                      )}
                    </Map>
                  </APIProvider>
                </div>
                {errors.location && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest mb-4">{errors.location}</p>}

                <input 
                  type="text"
                  value={formData.lastSeenAddress}
                  onChange={(e) => setFormData({ ...formData, lastSeenAddress: e.target.value })}
                  placeholder="Endereço aproximado..."
                  className="w-full bg-gray-50 rounded-2xl p-4 text-gray-800 placeholder:text-gray-400 focus:outline-none border border-gray-100 font-bold"
                />
              </div>

              <button 
                onClick={nextStep}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-95 transition-transform"
              >
                PRÓXIMO PASSO
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-8">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 block">Fotos e Vídeo</label>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {/* Photo slots */}
                  {[...Array(6)].map((_, i) => {
                    const item = media.filter(m => m.type === 'image')[i];
                    return (
                      <div key={`photo-${i}`} className="aspect-square relative">
                        {item ? (
                          <div className="w-full h-full rounded-2xl overflow-hidden group">
                            <img src={item.preview} className="w-full h-full object-cover" alt="" />
                            <button 
                              onClick={() => removeMedia(item.id)}
                              className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                            {uploadProgress[item.id] !== undefined && uploadProgress[item.id] < 100 && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-2">
                                <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                                  <div className="h-full bg-white" style={{ width: `${uploadProgress[item.id]}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => setShowBottomSheet('image')}
                            className={`w-full h-full rounded-2xl bg-gray-50 border-2 border-dashed flex items-center justify-center text-gray-300 active:scale-95 transition-all ${
                              errors.media && media.filter(m => m.type === 'image').length === 0 ? 'border-red-500' : 'border-gray-200'
                            }`}
                          >
                            <Camera size={24} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Video slot */}
                  <div className="aspect-square relative">
                    {media.find(m => m.type === 'video') ? (
                      <div className="w-full h-full rounded-2xl overflow-hidden group bg-black flex items-center justify-center">
                        <Video size={32} className="text-white" />
                        <button 
                          onClick={() => removeMedia(media.find(m => m.type === 'video')!.id)}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowBottomSheet('video')}
                        className="w-full h-full rounded-2xl bg-accent/10 border-2 border-dashed border-accent/20 flex items-center justify-center text-accent active:scale-95 transition-transform"
                      >
                        <Video size={24} />
                      </button>
                    )}
                  </div>
                </div>
                {errors.media && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest mb-4">{errors.media}</p>}

                <div className={`bg-gray-50 p-4 rounded-2xl border transition-colors ${
                  errors.description ? 'border-red-500' : 'border-gray-100'
                }`}>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Descrição Detalhada</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => {
                      setFormData({ ...formData, description: e.target.value });
                      if (e.target.value) setErrors(prev => ({ ...prev, description: '' }));
                    }}
                    maxLength={500}
                    placeholder="Ex: Estava usando uma coleira azul, é muito dócil, tem uma mancha branca na pata..."
                    className="w-full h-32 bg-transparent text-gray-800 placeholder:text-gray-400 focus:outline-none font-bold resize-none"
                  />
                  <div className="text-right text-[10px] font-bold text-gray-400">
                    {formData.description.length}/500
                  </div>
                </div>
                {errors.description && <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{errors.description}</p>}
              </div>

              <button 
                onClick={nextStep}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-95 transition-transform"
              >
                PRÓXIMO PASSO
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-8 p-6 bg-secondary/5 rounded-3xl border border-secondary/10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-secondary text-white p-3 rounded-2xl">
                      <Tag size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 leading-tight">Oferecer Recompensa?</h4>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Aumenta drasticamente as chances</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, hasReward: !formData.hasReward })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${formData.hasReward ? 'bg-secondary' : 'bg-gray-200'}`}
                  >
                    <motion.div 
                      animate={{ x: formData.hasReward ? 28 : 4 }}
                      className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {formData.hasReward && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={20} />
                      <input 
                        type="text"
                        value={formData.rewardAmount}
                        onChange={(e) => setFormData({ ...formData, rewardAmount: formatCurrency(e.target.value) })}
                        placeholder="Valor em R$"
                        className="w-full bg-white rounded-2xl p-4 pl-12 text-gray-800 focus:outline-none border border-secondary/20 font-black text-xl"
                      />
                    </div>
                    <div className="flex items-start gap-2 text-secondary/60">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      <p className="text-[10px] font-bold uppercase leading-relaxed">
                        A recompensa é paga com segurança pelo app após a confirmação do resgate.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-8">
                <h4 className="text-blue-900 font-black text-sm mb-2 flex items-center gap-2">
                  <Check size={18} />
                  Tudo pronto!
                </h4>
                <p className="text-blue-700 text-xs leading-relaxed font-bold">
                  Ao publicar, seu anúncio será enviado para todos os usuários próximos no Guarujá.
                </p>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-primary text-white py-5 rounded-3xl font-black text-lg shadow-2xl shadow-primary/40 active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    PUBLICANDO...
                  </>
                ) : (
                  <>
                    PUBLICAR ALERTA
                    <Check size={24} />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Sheet Simulation */}
      <AnimatePresence>
        {showBottomSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBottomSheet(null)}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[70] p-8 pb-12 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-black text-gray-900 mb-6 text-center uppercase tracking-wider">
                Adicionar {showBottomSheet === 'image' ? 'Foto' : 'Vídeo'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    if (showBottomSheet === 'image') fileInputRef.current?.click();
                    else videoInputRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-gray-50 border border-gray-100 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Camera size={28} />
                  </div>
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Câmera</span>
                </button>
                <button 
                  onClick={() => {
                    if (showBottomSheet === 'image') fileInputRef.current?.click();
                    else videoInputRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-gray-50 border border-gray-100 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                    <ImageIcon size={28} />
                  </div>
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Galeria</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => handleFileSelect(e, 'image')} 
        accept="image/*" 
        multiple 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={videoInputRef} 
        onChange={(e) => handleFileSelect(e, 'video')} 
        accept="video/*" 
        className="hidden" 
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-12 text-center">
          <div className="relative mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 border-4 border-primary/10 border-t-primary rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera size={32} className="text-primary animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Publicando Alerta</h2>
          <p className="text-gray-500 font-bold text-sm mb-8">Estamos processando suas mídias e notificando a comunidade...</p>
          
          <div className="w-full max-w-xs bg-gray-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/2 h-full bg-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PostPetPage;

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  InfoWindow, 
  useAdvancedMarkerRef, 
  useMap,
  ControlPosition,
  MapControl,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp, 
  addDoc,
  serverTimestamp,
  GeoPoint
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PetListing, Sighting } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Info, 
  AlertCircle, 
  Plus, 
  Check, 
  X, 
  Navigation, 
  Search,
  Filter,
  ChevronRight,
  PawPrint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Custom Map Style (Clean/Light)
const MAP_STYLE = [
  { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
  { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f2" }] },
  { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": 45 }] },
  { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }] },
  { "featureType": "road.arterial", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#c8d7d4" }, { "visibility": "on" }] }
];

interface MarkerWithInfoWindowProps {
  pet: PetListing;
  onMarkerLoad?: (marker: google.maps.marker.AdvancedMarkerElement) => void;
  onMarkerUnload?: (marker: google.maps.marker.AdvancedMarkerElement) => void;
}

const MarkerWithInfoWindow: React.FC<MarkerWithInfoWindowProps> = ({ pet, onMarkerLoad, onMarkerUnload }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const position = useMemo(() => {
    if (pet.location) return pet.location;
    if (pet.lastSeenLocation) return { lat: pet.lastSeenLocation.latitude, lng: pet.lastSeenLocation.longitude };
    return { lat: -23.9922, lng: -46.2592 };
  }, [pet.location, pet.lastSeenLocation]);

  useEffect(() => {
    if (marker && onMarkerLoad) {
      onMarkerLoad(marker);
      return () => {
        if (onMarkerUnload) onMarkerUnload(marker);
      };
    }
  }, [marker, onMarkerLoad, onMarkerUnload]);

  const isPerdido = pet.status === 'perdido';
  const isEncontrado = pet.status === 'encontrado';
  const isAvistado = pet.status === 'avistado';

  const markerColor = isPerdido ? '#FF4B4B' : isEncontrado ? '#4CAF50' : '#FFC107';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={() => setOpen(true)}
      >
        <div className="relative flex flex-col items-center group">
          <div 
            className="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center"
            style={{ borderColor: markerColor }}
          >
            {pet.photos && pet.photos[0] ? (
              <motion.img 
                layoutId={`pet-image-${pet.id}`}
                src={pet.photos[0]} 
                className="w-full h-full object-cover" 
                alt={pet.name} 
              />
            ) : (
              <PawPrint size={20} style={{ color: markerColor }} />
            )}
          </div>
          <div 
            className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-0.5 shadow-sm"
            style={{ borderTopColor: markerColor }}
          />
          {isPerdido && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-1 rounded-full font-black uppercase">
              !
            </div>
          )}
        </div>
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-0 min-w-[220px] overflow-hidden rounded-2xl">
            <div className="relative h-28">
              <motion.img 
                layoutId={`pet-image-${pet.id}`}
                src={pet.photos[0]} 
                className="w-full h-full object-cover" 
                alt={pet.name} 
              />
              <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white ${
                isPerdido ? 'bg-red-500' : isEncontrado ? 'bg-green-500' : 'bg-yellow-500'
              }`}>
                {pet.status}
              </div>
            </div>
            <div className="p-3 bg-white">
              <h3 className="font-black text-gray-900 text-sm mb-0.5">{pet.name || 'Sem nome'}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                <MapPin size={10} /> {pet.lastSeenNeighborhood || 'Guarujá'}
              </p>
              <button 
                onClick={() => navigate(`/pet/${pet.id}`)}
                className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-colors"
              >
                Ver Detalhes <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapPage: React.FC = () => {
  const [pets, setPets] = useState<PetListing[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'cao' | 'gato' | '24h'>('todos');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sightingMode, setSightingMode] = useState(false);
  const [sightingLocation, setSightingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showSightingSheet, setShowSightingSheet] = useState(false);
  const [petSearch, setPetSearch] = useState('');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [sightingDescription, setSightingDescription] = useState('');

  const [markers, setMarkers] = useState<{[key: string]: google.maps.marker.AdvancedMarkerElement}>({});

  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const clusterer = useRef<MarkerClusterer | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const navigate = useNavigate();

  // Marker Clustering
  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);

  useEffect(() => {
    if (!clusterer.current) return;
    clusterer.current.clearMarkers();
    clusterer.current.addMarkers(Object.values(markers));
  }, [markers]);

  const handleMarkerLoad = useCallback((id: string, marker: google.maps.marker.AdvancedMarkerElement) => {
    setMarkers(prev => ({ ...prev, [id]: marker }));
  }, []);

  const handleMarkerUnload = useCallback((id: string) => {
    setMarkers(prev => {
      const newMarkers = { ...prev };
      delete newMarkers[id];
      return newMarkers;
    });
  }, []);

  // Real-time stream with filters
  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'pets'));

    if (filter === 'cao') {
      q = query(collection(db, 'pets'), where('species', '==', 'cao'));
    } else if (filter === 'gato') {
      q = query(collection(db, 'pets'), where('species', '==', 'gato'));
    } else if (filter === '24h') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      q = query(collection(db, 'pets'), where('createdAt', '>=', Timestamp.fromDate(yesterday)));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const petsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PetListing));
      setPets(petsData);
      setLoading(false);
    }, (error) => {
      console.error('Error streaming pets:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  // Stream sightings
  useEffect(() => {
    const q = query(collection(db, 'sightings'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sightingsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let loc = { lat: 0, lng: 0 };
        if (data.location instanceof GeoPoint) {
          loc = { lat: data.location.latitude, lng: data.location.longitude };
        } else if (data.location && typeof data.location.lat === 'number') {
          loc = data.location;
        }
        return {
          id: doc.id,
          ...data,
          location: loc
        } as any;
      });
      setSightings(sightingsData);
    });
    return () => unsubscribe();
  }, []);

  // User Location Radius Circle
  useEffect(() => {
    if (!map || !userLocation || !mapsLib) return;

    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    circleRef.current = new google.maps.Circle({
      map,
      center: userLocation,
      radius: 5000, // 5km
      fillColor: '#FF9800',
      fillOpacity: 0.1,
      strokeColor: '#FF9800',
      strokeOpacity: 0.3,
      strokeWeight: 1,
      clickable: false
    });

    return () => {
      if (circleRef.current) circleRef.current.setMap(null);
    };
  }, [map, userLocation, mapsLib]);

  // User Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const centerOnUser = () => {
    if (userLocation && map) {
      map.panTo(userLocation);
      map.setZoom(15);
    }
  };

  const handleSightingConfirm = () => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        setSightingLocation({ lat: center.lat(), lng: center.lng() });
        setShowSightingSheet(true);
      }
    }
  };

  const submitSighting = async () => {
    if (!selectedPetId || !sightingLocation) return;

    try {
      setLoading(true);
      await addDoc(collection(db, 'sightings'), {
        petId: selectedPetId,
        reporterId: auth.currentUser?.uid || 'anonymous',
        reporterName: auth.currentUser?.displayName || 'Anônimo',
        location: new GeoPoint(sightingLocation.lat, sightingLocation.lng),
        description: sightingDescription,
        createdAt: serverTimestamp(),
        confirmed: false,
        photos: []
      });

      // Optimistic update - add a temporary marker or just close
      setSightingMode(false);
      setShowSightingSheet(false);
      setSightingDescription('');
      setSelectedPetId(null);
      setPetSearch('');
      
      // Show success toast (simulated)
      alert('Avistamento registrado com sucesso!');
    } catch (error) {
      console.error('Error submitting sighting:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPetsForSearch = useMemo(() => {
    if (!petSearch) return [];
    return pets.filter(p => 
      p.name?.toLowerCase().includes(petSearch.toLowerCase()) || 
      p.breed?.toLowerCase().includes(petSearch.toLowerCase())
    ).slice(0, 5);
  }, [pets, petSearch]);

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white p-8">
        <div className="text-center max-w-md">
          <div className="bg-primary/10 p-6 rounded-[40px] inline-block mb-6">
            <MapPin size={48} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4 text-center">Google Maps API Key Required</h2>
          <p className="text-gray-500 mb-8 leading-relaxed font-bold text-center">
            Para visualizar os pets no mapa, você precisa configurar sua chave de API do Google Maps.
          </p>
          <div className="bg-gray-50 p-6 rounded-3xl text-left border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Como configurar:</p>
            <ol className="space-y-3 text-sm font-bold text-gray-700">
              <li className="flex gap-3">
                <span className="bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                Obtenha uma chave no Google Cloud Console
              </li>
              <li className="flex gap-3">
                <span className="bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                Vá em Configurações (⚙️) → Secrets
              </li>
              <li className="flex gap-3">
                <span className="bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
                Adicione <code className="bg-gray-200 px-1 rounded">GOOGLE_MAPS_PLATFORM_KEY</code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-gray-100 overflow-hidden">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: -23.9937, lng: -46.2567 }}
          defaultZoom={13}
          mapId="PET_PERDIDO_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          disableDefaultUI={true}
          styles={MAP_STYLE}
          onClick={() => {
            if (sightingMode) return;
          }}
        >
          {!sightingMode && pets.map(pet => (
            <MarkerWithInfoWindow 
              key={pet.id} 
              pet={pet} 
              onMarkerLoad={(m) => handleMarkerLoad(pet.id, m)}
              onMarkerUnload={() => handleMarkerUnload(pet.id)}
            />
          ))}

          {/* Sighting Markers */}
          {!sightingMode && sightings.map(sighting => (
            <AdvancedMarker 
              key={sighting.id} 
              position={(sighting as any).location}
            >
              <div className="bg-yellow-400 p-1.5 rounded-full border-2 border-white shadow-md">
                <PawPrint size={14} className="text-white" />
              </div>
            </AdvancedMarker>
          ))}

          {/* User Location Marker */}
          {userLocation && !sightingMode && (
            <AdvancedMarker position={userLocation}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping" />
                <div className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg z-10" />
              </div>
            </AdvancedMarker>
          )}

          {/* Selection Pin for Sighting Mode */}
          {sightingMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="mb-10 flex flex-col items-center">
                <div className="bg-orange-500 text-white p-2 rounded-full shadow-2xl animate-bounce">
                  <MapPin size={32} />
                </div>
                <div className="w-2 h-2 bg-black/20 rounded-full blur-[1px] mt-1" />
              </div>
            </div>
          )}
        </Map>
      </APIProvider>

      {/* Top Filters */}
      <div className="absolute top-16 left-0 right-0 px-6 z-20">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'cao', label: 'Cães' },
            { id: 'gato', label: 'Gatos' },
            { id: '24h', label: 'Últimas 24h' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-md ${
                filter === f.id 
                  ? 'bg-primary text-white scale-105' 
                  : 'bg-white/90 backdrop-blur-md text-gray-600 hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAB - Marcar Avistamento */}
      {!sightingMode && (
        <div className="absolute bottom-24 right-6 z-20 flex flex-col gap-3">
          <button 
            onClick={centerOnUser}
            className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-gray-700 active:scale-95 transition-transform"
          >
            <Navigation size={20} />
          </button>
          <button 
            onClick={() => setSightingMode(true)}
            className="bg-orange-500 text-white pl-6 pr-8 py-4 rounded-[24px] shadow-2xl flex items-center gap-3 active:scale-95 transition-transform group"
          >
            <div className="bg-white/20 p-1.5 rounded-xl">
              <Plus size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
              Marcar avistamento aqui
            </span>
          </button>
        </div>
      )}

      {/* Sighting Mode Controls */}
      <AnimatePresence>
        {sightingMode && !showSightingSheet && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-24 left-6 right-6 z-30"
          >
            <div className="bg-white rounded-[32px] p-6 shadow-2xl border border-gray-100">
              <p className="text-center text-sm font-bold text-gray-500 mb-6 px-4">
                Mova o mapa para posicionar o marcador laranja onde você viu o pet.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSightingMode(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSightingConfirm}
                  className="flex-[2] bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-200 active:scale-95 transition-transform"
                >
                  Confirmar Local
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sighting Bottom Sheet */}
      <AnimatePresence>
        {showSightingSheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSightingSheet(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-50 p-8 pb-12 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Detalhes do Avistamento</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Qual pet você viu?</p>

              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </div>
                  <input 
                    type="text"
                    placeholder="Buscar pet por nome..."
                    value={petSearch}
                    onChange={(e) => setPetSearch(e.target.value)}
                    className="w-full bg-gray-50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold border border-gray-100 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  
                  {filteredPetsForSearch.length > 0 && !selectedPetId && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-10">
                      {filteredPetsForSearch.map(pet => (
                        <button 
                          key={pet.id}
                          onClick={() => {
                            setSelectedPetId(pet.id);
                            setPetSearch(pet.name);
                          }}
                          className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <img src={pet.photos[0]} className="w-10 h-10 rounded-xl object-cover" alt="" />
                          <div className="text-left">
                            <p className="text-sm font-black text-gray-900">{pet.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{pet.breed}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">O que ele estava fazendo?</label>
                  <textarea 
                    value={sightingDescription}
                    onChange={(e) => setSightingDescription(e.target.value)}
                    placeholder="Ex: Estava correndo em direção à praia, parecia assustado..."
                    className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold border border-gray-100 focus:outline-none focus:border-orange-500 transition-colors h-32 resize-none"
                  />
                </div>

                <button 
                  onClick={submitSighting}
                  disabled={!selectedPetId || loading}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${
                    selectedPetId && !loading
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 active:scale-95'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Enviando...' : 'Registrar Avistamento'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {loading && !showSightingSheet && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

export default MapPage;

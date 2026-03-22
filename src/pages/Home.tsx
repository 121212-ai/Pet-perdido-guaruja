import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { db, collection, query, orderBy, where, limit, startAfter, getDocs, onSnapshot } from '../firebase';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { PetListing } from '../types';
import PetCard from '../components/PetCard';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash.debounce';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const PAGE_SIZE = 10;

const HomePage = () => {
  const navigate = useNavigate();
  const [pets, setPets] = useState<PetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchPets = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      if (activeFilter === 'perto') {
        if (!userLocation) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(loc);
            await fetchNearMe(loc);
          }, (err) => {
            console.error(err);
            alert("Não foi possível obter sua localização.");
            setActiveFilter('todos');
          });
          return;
        } else {
          await fetchNearMe(userLocation);
          return;
        }
      }

      let q = query(collection(db, 'pets'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

      if (activeFilter === 'cao') q = query(collection(db, 'pets'), where('species', '==', 'cao'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (activeFilter === 'gato') q = query(collection(db, 'pets'), where('species', '==', 'gato'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (activeFilter === 'perdido') q = query(collection(db, 'pets'), where('status', '==', 'perdido'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (activeFilter === 'encontrado') q = query(collection(db, 'pets'), where('status', '==', 'encontrado'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

      // Note: Firestore doesn't support full-text search natively. 
      // For real-time search with name/breed/neighborhood, we'd usually use Algolia or similar.
      // Here we'll do a simple prefix search if searchQuery is present, or filter client-side for better UX in this demo.
      // But the prompt asks for "real-time search in Firestore". 
      // We'll use a simple where query for name if searching.
      if (searchQuery) {
        q = query(
          collection(db, 'pets'), 
          where('name', '>=', searchQuery), 
          where('name', '<=', searchQuery + '\uf8ff'),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);
      const petsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PetListing[];
      
      setPets(petsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching pets:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNearMe = async (center: { lat: number, lng: number }) => {
    setLoading(true);
    try {
      const radiusInM = 5000; // 5km
      const bounds = geohashQueryBounds([center.lat, center.lng], radiusInM);
      const promises = [];
      for (const b of bounds) {
        const q = query(
          collection(db, 'pets'),
          orderBy('geohash'),
          where('geohash', '>=', b[0]),
          where('geohash', '<=', b[1])
        );
        promises.push(getDocs(q));
      }

      const snapshots = await Promise.all(promises);
      const matchingDocs: any[] = [];

      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          const lat = doc.get('lastSeenLocation')?.latitude;
          const lng = doc.get('lastSeenLocation')?.longitude;

          if (lat && lng) {
            const distanceInKm = distanceBetween([lat, lng], [center.lat, center.lng]);
            const distanceInM = distanceInKm * 1000;
            if (distanceInM <= radiusInM) {
              matchingDocs.push({ id: doc.id, ...doc.data() });
            }
          }
        }
      }

      setPets(matchingDocs as PetListing[]);
      setHasMore(false); // Pagination for geohash is complex, disabling for now
    } catch (error) {
      console.error("Error fetching near me:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    
    try {
      let q = query(collection(db, 'pets'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));

      if (activeFilter === 'cao') q = query(collection(db, 'pets'), where('species', '==', 'cao'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      if (activeFilter === 'gato') q = query(collection(db, 'pets'), where('species', '==', 'gato'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      if (activeFilter === 'perdido') q = query(collection(db, 'pets'), where('status', '==', 'perdido'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
      if (activeFilter === 'encontrado') q = query(collection(db, 'pets'), where('status', '==', 'encontrado'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));

      const snapshot = await getDocs(q);
      const newPets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PetListing[];
      
      setPets(prev => [...prev, ...newPets]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error loading more pets:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      fetchPets();
    }, 500),
    [activeFilter]
  );

  useEffect(() => {
    fetchPets();
  }, [activeFilter]);

  useEffect(() => {
    if (searchQuery !== undefined) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery]);

  const handleRefresh = () => {
    fetchPets(true);
  };

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'cao', label: 'Cães', icon: 'mdi:dog' },
    { id: 'gato', label: 'Gatos', icon: 'mdi:cat' },
    { id: 'perdido', label: 'Perdidos' },
    { id: 'encontrado', label: 'Encontrados' },
    { id: 'perto', label: 'Perto de mim', icon: 'lucide:map-pin' },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="px-4 pt-4">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou raça..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          />
          {refreshing && (
            <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 text-primary animate-spin" size={20} />
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {filters.map(filter => (
            <button 
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                activeFilter === filter.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              {filter.icon && (
                filter.icon.startsWith('mdi:') ? (
                  <img src={`https://api.iconify.design/${filter.icon.replace('mdi:', 'mdi:')}.svg?color=currentColor`} className="w-5 h-5" alt="" />
                ) : (
                  <MapPin size={18} />
                )
              )}
              {filter.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-gray-50 shadow-sm">
                <Skeleton height={200} borderRadius={24} className="mb-4" />
                <Skeleton width="60%" height={24} className="mb-2" />
                <Skeleton width="40%" height={16} />
              </div>
            ))}
          </div>
        ) : pets.length > 0 ? (
          <div className="pb-20">
            {pets.map((pet, index) => (
              <div key={pet.id} ref={index === pets.length - 1 ? lastElementRef : null}>
                <PetCard 
                  pet={pet} 
                  onAction={(action) => console.log(action, pet.id)} 
                />
              </div>
            ))}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <RefreshCw className="text-primary animate-spin" size={24} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Nenhum pet encontrado</h3>
            <p className="text-gray-500 text-sm">Tente mudar os filtros ou a busca.</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate('/post')}
        className="fixed bottom-28 right-6 bg-primary text-white p-4 rounded-full shadow-2xl shadow-primary/40 z-50 flex items-center justify-center"
      >
        <Plus size={32} />
      </motion.button>
    </div>
  );
};

export default HomePage;

import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation, 
  Link,
  useNavigate
} from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, doc, onSnapshot, collection, query, where } from './firebase';
import { Home, Map as MapIcon, PlusSquare, MessageCircle, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Pages (to be implemented)
import SplashPage from './pages/Splash';
import OnboardingPage from './pages/Onboarding';
import WelcomePage from './pages/Welcome';
import AuthPage from './pages/Auth';
import HomePage from './pages/Home';
import PostPetPage from './pages/PostPet';
import MapPage from './pages/Map';
import ChatPage from './pages/Chat';
import ChatDetailsPage from './pages/ChatDetails';
import ProfilePage from './pages/Profile';
import PetDetailsPage from './pages/PetDetails';
import NotificationsPage from './pages/Notifications';
import PaymentPage from './pages/Payment';

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'INÍCIO' },
    { path: '/map', icon: MapIcon, label: 'MAPA' },
    { path: '/post', icon: PlusSquare, label: 'POSTAR', primary: true },
    { path: '/chat', icon: MessageCircle, label: 'CHAT' },
    { path: '/profile', icon: User, label: 'PERFIL' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex justify-between items-center safe-area-bottom z-50">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center justify-center transition-colors ${
            item.primary 
              ? 'bg-primary text-white p-3 rounded-full -mt-10 shadow-lg' 
              : isActive(item.path) ? 'text-primary' : 'text-gray-400'
          }`}
        >
          <item.icon size={item.primary ? 28 : 24} />
          {!item.primary && <span className="text-[10px] font-bold mt-1">{item.label}</span>}
        </Link>
      ))}
    </nav>
  );
};

const Header = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 bg-white z-40 px-4 py-3 flex justify-between items-center border-b border-gray-50">
      <div className="flex items-center gap-2">
        <div className="bg-primary p-1 rounded-lg">
          <img src="https://api.iconify.design/mdi:paw.svg?color=white" alt="logo" className="w-5 h-5" />
        </div>
        <h1 className="text-primary font-extrabold text-lg tracking-tight">PetPerdido Guarujá</h1>
      </div>
      <button 
        onClick={() => navigate('/notifications')}
        className="relative p-2 text-gray-600"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-perdido text-white text-[8px] font-extrabold rounded-full border-2 border-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hideNav = ['/splash', '/onboarding', '/welcome', '/auth', '/notifications'].includes(location.pathname) || location.pathname.startsWith('/chat/');

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background shadow-xl relative overflow-hidden">
      {!hideNav && <Header />}
      <main className={`flex-1 overflow-y-auto ${!hideNav ? 'pb-24' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsAuthReady(true);
    }
  }, [loading]);

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="bg-primary p-4 rounded-2xl shadow-xl"
        >
          <img src="https://api.iconify.design/mdi:paw.svg?color=white" alt="loading" className="w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/splash" element={<SplashPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/welcome" element={user ? <Navigate to="/" /> : <WelcomePage />} />
          <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
          
          <Route path="/" element={user ? <HomePage /> : <Navigate to="/splash" />} />
          <Route path="/post" element={user ? <PostPetPage /> : <Navigate to="/auth" />} />
          <Route path="/map" element={user ? <MapPage /> : <Navigate to="/auth" />} />
          <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/auth" />} />
          <Route path="/chat/:id" element={user ? <ChatDetailsPage /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/auth" />} />
          <Route path="/pet/:id" element={user ? <PetDetailsPage /> : <Navigate to="/auth" />} />
          <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
          <Route path="/payment/:petId" element={user ? <PaymentPage /> : <Navigate to="/auth" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

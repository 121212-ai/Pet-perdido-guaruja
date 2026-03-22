import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, orderBy, onSnapshot, auth } from '../firebase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: any;
  read: boolean;
  type: string;
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center gap-4 border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="text-gray-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-extrabold text-gray-900">Notificações</h1>
      </header>

      <div className="flex-1 px-4 py-6">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-50"></div>
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <div className="flex flex-col gap-4">
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-2xl border ${
                  notif.read ? 'bg-white border-gray-50' : 'bg-primary/5 border-primary/10'
                } flex gap-4`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  notif.read ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white'
                }`}>
                  <Bell size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-bold text-sm ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {formatDistanceToNow(notif.createdAt.toDate(), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {notif.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Tudo limpo por aqui!</h3>
            <p className="text-gray-500 text-sm">Você não tem notificações no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;

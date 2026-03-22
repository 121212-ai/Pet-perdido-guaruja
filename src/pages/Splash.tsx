import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const SplashScreen = () => {
  const navigate = useNavigate();
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        if (user) {
          navigate('/');
        } else {
          // Check if onboarding was already seen (optional, but let's go to onboarding for now)
          navigate('/onboarding');
        }
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

  return (
    <div className="h-screen bg-[#FFF7ED] flex flex-col items-center justify-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="bg-primary p-5 rounded-[2.5rem] shadow-2xl mb-6">
          <img src="https://api.iconify.design/mdi:paw.svg?color=white" className="w-16 h-16" alt="logo" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-[#431407] tracking-tight">PetPerdido</h1>
          <p className="text-primary font-bold tracking-[0.3em] text-sm mt-1">GUARUJÁ</p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12"
      >
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary/20 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
          <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]"></div>
        </div>
      </motion.div>
    </div>
  );
};

export default SplashScreen;

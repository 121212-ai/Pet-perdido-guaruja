import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-[#FFF7ED] flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Background paw prints */}
      <div className="absolute top-10 left-10 opacity-5 rotate-12">
        <img src="https://api.iconify.design/mdi:paw.svg?color=%23F97316" className="w-24 h-24" alt="" />
      </div>
      <div className="absolute bottom-20 right-10 opacity-5 -rotate-12">
        <img src="https://api.iconify.design/mdi:paw.svg?color=%23F97316" className="w-32 h-32" alt="" />
      </div>

      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center mb-12"
      >
        <div className="bg-primary p-3 rounded-2xl shadow-lg mb-4">
          <img src="https://api.iconify.design/mdi:paw.svg?color=white" className="w-10 h-10" alt="logo" />
        </div>
        <h1 className="text-4xl font-extrabold text-[#431407] tracking-tight">PetPerdido</h1>
        <p className="text-primary font-bold tracking-[0.2em] text-sm">GUARUJÁ</p>
      </motion.div>

      <div className="relative w-full max-w-[300px] mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
        >
          <img 
            src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400" 
            className="w-full aspect-square object-cover" 
            alt="pet" 
          />
        </motion.div>
        
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute -bottom-4 -right-4 bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
        >
          <Heart size={16} className="text-perdido fill-perdido" />
          <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Esperança</span>
        </motion.div>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-2xl font-extrabold text-[#1F2937] mb-3 leading-tight">
          Todo pet merece voltar<br />pra casa.
        </h2>
        <p className="text-gray-500 text-sm px-4">
          A maior rede de apoio para encontrar animais perdidos no litoral.
        </p>
      </motion.div>

      <div className="w-full flex flex-col gap-4">
        <button 
          onClick={() => navigate('/auth')}
          className="w-full bg-white border border-gray-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <img src="https://api.iconify.design/logos:google-icon.svg" className="w-5 h-5" alt="google" />
          Entrar com Google
        </button>
        
        <button 
          onClick={() => navigate('/auth')}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
        >
          Criar conta
        </button>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Já tenho conta? <span onClick={() => navigate('/auth')} className="text-primary font-bold cursor-pointer">Entrar</span>
      </p>
    </div>
  );
};

export default WelcomePage;

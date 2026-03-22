import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ArrowRight } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: "Encontre pets perdidos no Guarujá",
    description: "A maior rede de apoio para encontrar animais perdidos no litoral.",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400",
    color: "#F97316"
  },
  {
    id: 2,
    title: "Publique fotos, localização e recompensa",
    description: "Crie alertas rápidos e detalhados para mobilizar a comunidade.",
    image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=400",
    color: "#F59E0B"
  },
  {
    id: 3,
    title: "Conecte-se com sua comunidade",
    description: "Receba notificações em tempo real e ajude outros donos.",
    image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400",
    color: "#06B6D4"
  }
];

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate('/auth');
    }
  };

  const skip = () => {
    navigate('/auth');
  };

  return (
    <div className="h-screen bg-[#FFF7ED] flex flex-col relative overflow-hidden">
      {/* Skip Button */}
      <button
        onClick={skip}
        className="absolute top-12 right-6 z-50 text-gray-400 font-bold text-sm uppercase tracking-widest hover:text-primary transition-colors"
      >
        Pular
      </button>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <div className="relative w-full max-w-[280px] mb-12">
              <motion.div
                initial={{ scale: 0.8, rotate: -5 }}
                animate={{ scale: 1, rotate: 0 }}
                className="rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white aspect-square"
              >
                <img
                  src={slides[currentSlide].image}
                  className="w-full h-full object-cover"
                  alt="onboarding"
                />
              </motion.div>
              <div className="absolute -bottom-4 -right-4 bg-white p-4 rounded-full shadow-lg">
                <img src="https://api.iconify.design/mdi:paw.svg?color=%23F97316" className="w-6 h-6" alt="" />
              </div>
            </div>

            <h2 className="text-3xl font-extrabold text-[#1F2937] mb-4 leading-tight">
              {slides[currentSlide].title}
            </h2>
            <p className="text-gray-500 text-lg px-2 leading-relaxed">
              {slides[currentSlide].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="px-8 pb-16 flex flex-col items-center">
        {/* Indicators */}
        <div className="flex gap-2 mb-10">
          {slides.map((_, index) => (
            <motion.div
              key={index}
              animate={{
                width: currentSlide === index ? 32 : 8,
                backgroundColor: currentSlide === index ? "#F97316" : "#E5E7EB"
              }}
              className="h-2 rounded-full transition-all duration-300"
            ></motion.div>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={nextSlide}
          className="w-full bg-primary text-white py-5 rounded-[2rem] font-extrabold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95"
        >
          {currentSlide === slides.length - 1 ? "Começar Agora" : "Próximo"}
          {currentSlide === slides.length - 1 ? <ArrowRight size={24} /> : <ChevronRight size={24} />}
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;

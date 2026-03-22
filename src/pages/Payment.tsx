import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  QrCode, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Smartphone,
  Info,
  Shield
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PetListing } from '../types';

const PaymentPage: React.FC = () => {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const finderId = queryParams.get('finderId');

  const [pet, setPet] = useState<PetListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | null>(null);
  const [step, setStep] = useState<'selection' | 'processing' | 'success'>('selection');
  
  // PIX State
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  
  // Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchPet = async () => {
      if (!petId) return;
      try {
        const docRef = doc(db, 'pets', petId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPet({ id: docSnap.id, ...docSnap.data() } as PetListing);
        }
      } catch (error) {
        console.error('Error fetching pet:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPet();
  }, [petId]);

  useEffect(() => {
    if (paymentMethod === 'pix' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentMethod, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePixSelection = () => {
    setPaymentMethod('pix');
    // Simulate API call to MercadoPago
    setPixCode('00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865405500.005802BR5913PETPERDIDO6008GUARUJA62070503***6304E2CA');
    
    // Simulate polling
    setTimeout(() => {
      handlePaymentSuccess('pix');
    }, 10000); // Success after 10 seconds for demo
  };

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardName || !expiry || !cvv) return;

    setIsProcessing(true);
    // Simulate tokenization and processing
    setTimeout(() => {
      handlePaymentSuccess('card');
    }, 3000);
  };

  const handlePaymentSuccess = async (method: 'pix' | 'card') => {
    if (!pet || !auth.currentUser || !finderId) return;

    try {
      // 1. Create reward document in escrow
      await addDoc(collection(db, 'rewards'), {
        petId: pet.id,
        petName: pet.name,
        petPhoto: pet.photos[0],
        ownerId: auth.currentUser.uid,
        finderId: finderId,
        amount: pet.rewardAmount || 0,
        status: 'escrow',
        paymentMethod: method,
        createdAt: serverTimestamp(),
      });

      // 2. Notify finder
      await addDoc(collection(db, 'notifications'), {
        userId: finderId,
        title: '💰 Recompensa aguardando!',
        message: `O dono do pet "${pet.name}" já pagou a recompensa. Ela será liberada assim que ele confirmar o reencontro!`,
        type: 'reward_escrow',
        petId: pet.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      // Trigger confetti
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6321', '#F27D26', '#5A5A40']
      });

      setStep('success');
    } catch (error) {
      console.error('Error processing payment success:', error);
      setIsProcessing(false);
    }
  };

  const copyPixCode = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      alert('Código PIX copiado!');
    }
  };

  if (loading || !pet) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle2 size={64} />
        </motion.div>
        
        <h1 className="text-3xl font-black text-gray-900 mb-2">Pagamento Confirmado!</h1>
        <p className="text-gray-500 mb-8 font-bold">
          O valor da recompensa está seguro em nossa conta e será liberado para quem encontrou o {pet.name} assim que você confirmar o reencontro.
        </p>

        <div className="bg-gray-50 rounded-[32px] p-6 w-full mb-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <img src={pet.photos[0]} className="w-16 h-16 rounded-2xl object-cover" alt={pet.name} />
            <div className="text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recompensa para</p>
              <h3 className="text-xl font-black text-gray-900">{pet.name}</h3>
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <span className="text-gray-500 font-bold">Valor em Escrow</span>
            <span className="text-2xl font-black text-secondary">R$ {pet.rewardAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/chat` /* or specific chat */)}
          className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform"
        >
          Voltar para o Chat
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black text-gray-900">Pagamento Seguro</h1>
        <div className="ml-auto bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
          <ShieldCheck size={14} />
          Protegido
        </div>
      </div>

      <div className="p-6">
        {/* Security Banner */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="w-24 h-24 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mb-4 relative z-10"
            >
              <ShieldCheck size={48} />
            </motion.div>
            
            {/* Animated rings around the shield */}
            <motion.div 
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-secondary/20 rounded-full -z-0"
            />
            <motion.div 
              animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              className="absolute inset-0 bg-secondary/10 rounded-full -z-0"
            />
            
            {/* Small floating lock icons */}
            <motion.div 
              animate={{ y: [-10, 10, -10], x: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -top-2 -right-2 bg-white p-2 rounded-xl shadow-lg text-secondary"
            >
              <Lock size={16} />
            </motion.div>
            <motion.div 
              animate={{ y: [10, -10, 10], x: [5, -5, 5] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -bottom-2 -left-2 bg-white p-2 rounded-xl shadow-lg text-secondary"
            >
              <Shield size={16} />
            </motion.div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mt-4 mb-2 leading-tight">Garantia de Reencontro</h2>
          <p className="text-gray-500 text-sm font-bold leading-relaxed px-4">
            Seu pagamento está seguro e só será liberado após sua confirmação.
          </p>
        </div>

        {/* Pet Card */}
        <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 mb-8">
          <div className="relative h-48">
            <img src={pet.photos[0]} className="w-full h-full object-cover" alt={pet.name} />
            <div className="absolute top-4 left-4">
              <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-lg">
                Encontrado
              </span>
            </div>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Recompensa para</p>
            <h3 className="text-2xl font-black text-gray-900 mb-2">{pet.name}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-gray-400 font-bold">R$</span>
              <span className="text-4xl font-black text-gray-900">
                {pet.rewardAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-2xl mb-8 flex gap-3">
          <Lock size={20} className="text-blue-500 shrink-0 mt-1" />
          <p className="text-xs font-bold text-blue-700 leading-relaxed">
            <span className="block font-black mb-1">Segurança Garantida:</span>
            O valor só é liberado após você confirmar que recebeu seu pet.
          </p>
        </div>

        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 px-2">Método de Pagamento</h3>

        {!paymentMethod ? (
          <div className="space-y-4">
            <button
              onClick={handlePixSelection}
              className="w-full bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all group"
            >
              <div className="bg-primary/10 p-4 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Smartphone size={24} />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-black text-gray-900">PIX</h4>
                <p className="text-xs text-gray-400 font-bold">Liberação instantânea</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            <button
              onClick={() => setPaymentMethod('card')}
              className="w-full bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all group"
            >
              <div className="bg-secondary/10 p-4 rounded-2xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
                <CreditCard size={24} />
              </div>
              <div className="text-left flex-1">
                <h4 className="font-black text-gray-900">Cartão de Crédito</h4>
                <p className="text-xs text-gray-400 font-bold">Até 12x com juros</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>
        ) : paymentMethod === 'pix' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl text-center"
          >
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black text-gray-900">Pagamento via PIX</h4>
              <button onClick={() => setPaymentMethod(null)} className="text-primary text-xs font-black uppercase tracking-widest">Alterar</button>
            </div>

            <div className="bg-gray-50 p-6 rounded-[32px] mb-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                <QrCode size={160} className="text-gray-900" />
              </div>
              <div className="flex items-center gap-2 text-perdido font-black text-sm mb-1">
                <Clock size={16} />
                <span>Expira em {formatTime(timeLeft)}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aguardando pagamento...</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={copyPixCode}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Copy size={18} />
                Copiar Código PIX
              </button>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                Abra o app do seu banco, escolha "Pagar com PIX" e cole o código ou escaneie o QR Code.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black text-gray-900">Cartão de Crédito</h4>
              <button onClick={() => setPaymentMethod(null)} className="text-primary text-xs font-black uppercase tracking-widest">Alterar</button>
            </div>

            <form onSubmit={handleCardPayment} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Número do Cartão</label>
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Nome no Cartão</label>
                <input
                  type="text"
                  placeholder="COMO ESTÁ NO CARTÃO"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Validade</label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-secondary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-secondary/20 active:scale-95 transition-transform flex items-center justify-center gap-2 mt-4"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Lock size={18} />
                    Pagar com Segurança
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* Trust Badges */}
        <div className="mt-10 grid grid-cols-2 gap-6 opacity-40 grayscale">
          <div className="flex flex-col items-center gap-2">
            <div className="bg-gray-200 p-3 rounded-full">
              <ShieldCheck size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest">SSL Secure</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="bg-gray-200 p-3 rounded-full">
              <Lock size={20} />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest">Criptografado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;

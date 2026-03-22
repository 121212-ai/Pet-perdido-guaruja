import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  db, 
  doc, 
  setDoc, 
  serverTimestamp,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from '../firebase';
import { Mail, Lock, User, ArrowLeft, AlertCircle, Phone, MapPin, X } from 'lucide-react';

const Snackbar = ({ message, onClose, type = 'error' }: { message: string, onClose: () => void, type?: 'error' | 'success' }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={`fixed bottom-6 left-6 right-6 p-4 rounded-2xl shadow-2xl z-[100] flex items-center justify-between ${
      type === 'error' ? 'bg-perdido text-white' : 'bg-encontrado text-white'
    }`}
  >
    <div className="flex items-center gap-3">
      <AlertCircle size={20} />
      <span className="font-bold text-sm">{message}</span>
    </div>
    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
      <X size={18} />
    </button>
  </motion.div>
);

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const validatePhone = (phone: string) => {
    // Basic BR phone validation (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    return /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(phone);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || 'Usuário',
        email: user.email,
        photoURL: user.photoURL,
        city: 'Guarujá',
        state: 'SP',
        reputation: 5,
        petsHelped: 0,
        createdAt: serverTimestamp(),
        fcmToken: '', // To be updated later
      }, { merge: true });

      navigate('/');
    } catch (err: any) {
      setError('Erro ao entrar com Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateEmail(email)) {
      setError('Por favor, insira um e-mail válido.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        if (!name || !phone || !neighborhood) {
          setError('Todos os campos são obrigatórios.');
          setLoading(false);
          return;
        }

        if (!validatePhone(phone)) {
          setError('Formato de telefone inválido. Use (XX) XXXXX-XXXX.');
          setLoading(false);
          return;
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name,
          email,
          phone,
          neighborhood,
          city: 'Guarujá',
          state: 'SP',
          reputation: 5,
          petsHelped: 0,
          createdAt: serverTimestamp(),
          fcmToken: '',
        });

        navigate('/');
      }
    } catch (err: any) {
      let msg = 'Ocorreu um erro. Tente novamente.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este e-mail já está em uso.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Insira seu e-mail para recuperar a senha.');
      return;
    }
    if (!validateEmail(email)) {
      setError('E-mail inválido.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('E-mail de recuperação enviado!');
    } catch (err: any) {
      setError('Erro ao enviar e-mail: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-8 pb-10">
      <button onClick={() => navigate('/welcome')} className="mb-8 text-gray-400 w-fit">
        <ArrowLeft size={24} />
      </button>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {isLogin ? 'Bem-vindo de volta! 👋' : 'Crie sua conta 🐾'}
        </h1>
        <p className="text-gray-500">
          {isLogin ? 'Sentimos sua falta. Entre para continuar ajudando pets.' : 'Junte-se à nossa comunidade e ajude a salvar vidas.'}
        </p>
      </div>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
        {!isLogin && (
          <>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="tel" 
                placeholder="Telefone (ex: 13 99999-9999)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Seu bairro no Guarujá"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </>
        )}

        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="email" 
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="password" 
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        {isLogin && (
          <button 
            type="button"
            onClick={handleForgotPassword}
            className="text-right text-sm font-bold text-primary hover:underline"
          >
            Esqueceu a senha?
          </button>
        )}

        <button 
          type="submit"
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 mt-4 hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center"
          disabled={loading}
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (isLogin ? 'Entrar' : 'Cadastrar')}
        </button>

        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-[1px] bg-gray-100"></div>
          <span className="text-gray-400 text-sm font-bold uppercase tracking-wider">OU</span>
          <div className="flex-1 h-[1px] bg-gray-100"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full bg-white border border-gray-100 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <img src="https://api.iconify.design/logos:google-icon.svg" className="w-5 h-5" alt="google" />
          Entrar com Google
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'} {' '}
        <span 
          onClick={() => setIsLogin(!isLogin)} 
          className="text-primary font-bold cursor-pointer"
        >
          {isLogin ? 'Cadastre-se' : 'Entrar'}
        </span>
      </p>

      <AnimatePresence>
        {error && <Snackbar message={error} onClose={() => setError('')} type="error" />}
        {success && <Snackbar message={success} onClose={() => setSuccess('')} type="success" />}
      </AnimatePresence>
    </div>
  );
};

export default AuthPage;

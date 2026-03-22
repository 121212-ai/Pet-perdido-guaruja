import { Timestamp, GeoPoint } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  phone?: string;
  neighborhood?: string;
  city: string;
  state: string;
  reputation: number;
  petsHelped: number;
  badge?: 'voluntario' | 'heroi' | 'platina';
  createdAt: Timestamp;
  fcmToken?: string;
}

export interface Review {
  id: string;
  targetUserId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
}

export interface PetListing {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto?: string;
  ownerPhone?: string;
  name: string;
  species: 'cao' | 'gato';
  breed?: string;
  color?: string;
  size: 'pequeno' | 'medio' | 'grande';
  age?: string;
  hasMicrochip: boolean;
  microchipCode?: string;
  status: 'perdido' | 'encontrado' | 'avistado';
  photos: string[];
  videoURL?: string;
  description: string;
  lastSeenAddress?: string;
  lastSeenNeighborhood?: string;
  lastSeenLocation?: GeoPoint;
  location?: { lat: number; lng: number };
  lostDate?: Timestamp;
  hasReward: boolean;
  rewardAmount?: number;
  rewardCurrency: 'BRL';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  viewCount: number;
  shareCount: number;
}

export interface Sighting {
  id: string;
  petId: string;
  reporterId: string;
  reporterName: string;
  location: GeoPoint;
  address?: string;
  neighborhood?: string;
  description: string;
  photos: string[];
  createdAt: Timestamp;
  confirmed: boolean;
}

export interface ChatSession {
  id: string;
  participants: string[];
  petId: string;
  petName: string;
  petPhoto?: string;
  lastMessage: string;
  lastMessageAt: Timestamp;
  rewardPaid: boolean;
  status: 'ativo' | 'resolvido';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'location' | 'system';
  imageURL?: string;
  location?: GeoPoint;
  createdAt: Timestamp;
  read: boolean;
}

export interface Reward {
  id: string;
  petId: string;
  petName: string;
  petPhoto?: string;
  ownerId: string;
  finderId: string;
  amount: number;
  status: 'escrow' | 'liberado' | 'reembolsado';
  paymentMethod: 'pix' | 'card';
  createdAt: Timestamp;
  releasedAt?: Timestamp;
}

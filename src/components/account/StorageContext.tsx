"use client";
import { createContext, useContext } from 'react';
import type { CloudSnapshot, CloudStore } from '@/lib/cloud-book';
export const StorageContext = createContext<{ store: CloudStore; initial: CloudSnapshot } | null>(null);
export const useCloudStorage = () => useContext(StorageContext);

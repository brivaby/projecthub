'use client';
import { useEffect,useState } from 'react';
export function ThemeToggle(){const [theme,setTheme]=useState('light');useEffect(()=>{const saved=localStorage.getItem('vic-theme');if(saved==='dark'){setTheme(saved);document.documentElement.dataset.theme=saved;}},[]);return <button className="theme-toggle" aria-label={`Use ${theme==='light'?'dark':'light'} mode`} onClick={()=>{const value=theme==='light'?'dark':'light';setTheme(value);localStorage.setItem('vic-theme',value);document.documentElement.dataset.theme=value;}}>{theme==='light'?'◐ Dark mode':'☀ Light mode'}</button>;}

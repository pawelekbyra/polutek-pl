"use client";

import React, { useEffect, useState } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wired-button': any; // intentional experimental style override
      'wired-input': any; // intentional experimental style override
      'wired-checkbox': any; // intentional experimental style override
      'wired-radio': any; // intentional experimental style override
      'wired-card': any; // intentional experimental style override
      'wired-slider': any; // intentional experimental style override
    }
  }
}

// Dynamic import for wired elements as they are custom elements and might need side effects
export const WiredButton = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <button className="px-4 py-2 border border-slate-300 rounded opacity-50">{props.children}</button>;
  return <wired-button {...props}>{props.children}</wired-button>;
};

export const WiredInput = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input className="px-4 py-2 border border-slate-300 rounded" />;
  return <wired-input {...props} />;
};

export const WiredCheckbox = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input type="checkbox" />;
  return <wired-checkbox {...props} />;
};

export const WiredRadio = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input type="radio" />;
  return <wired-radio {...props} />;
};

export const WiredCard = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="p-4 border border-slate-300 rounded">{props.children}</div>;
  return <wired-card {...props}>{props.children}</wired-card>;
};

export const WiredSlider = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="h-2 w-full bg-slate-200" />;
  return <wired-slider {...props} />;
};

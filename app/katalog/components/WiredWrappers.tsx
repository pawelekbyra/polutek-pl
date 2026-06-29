"use client";

import React, { useEffect, useState } from 'react';

// Dynamic import for wired elements as they are custom elements and might need side effects
export const WiredButton = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <button className="px-4 py-2 border border-slate-300 rounded opacity-50">{props.children}</button>;
  // @ts-ignore
  return <wired-button {...props}>{props.children}</wired-button>;
};

export const WiredInput = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input className="px-4 py-2 border border-slate-300 rounded" />;
  // @ts-ignore
  return <wired-input {...props} />;
};

export const WiredCheckbox = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input type="checkbox" />;
  // @ts-ignore
  return <wired-checkbox {...props} />;
};

export const WiredRadio = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <input type="radio" />;
  // @ts-ignore
  return <wired-radio {...props} />;
};

export const WiredCard = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="p-4 border border-slate-300 rounded">{props.children}</div>;
  // @ts-ignore
  return <wired-card {...props}>{props.children}</wired-card>;
};

export const WiredSlider = (props: any) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    import('wired-elements').then(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="h-2 w-full bg-slate-200" />;
  // @ts-ignore
  return <wired-slider {...props} />;
};

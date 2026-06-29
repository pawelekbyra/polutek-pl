"use client";

import React from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}

export function Slider({ label, value, min, max, step, onChange, unit = "" }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-mono text-neutral-500">{label}</span>
        <span className="text-[11px] font-mono text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-neutral-900 cursor-pointer"
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-neutral-500">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-8 h-4 rounded-full transition-colors ${value ? "bg-neutral-900" : "bg-neutral-200"}`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-mono text-neutral-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-neutral-200"
        />
        <span className="text-[10px] font-mono text-neutral-400">{value}</span>
      </div>
    </div>
  );
}

interface PillSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function PillSelect({ label, value, options, onChange }: PillSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-mono text-neutral-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              value === opt.value
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SeedControlProps {
  value: number;
  onChange: (v: number) => void;
}

export function SeedControl({ value, onChange }: SeedControlProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-mono text-neutral-500">seed</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={1}
          max={9999}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-14 text-[11px] font-mono text-center border border-neutral-200 rounded px-1 py-0.5"
        />
        <button
          onClick={() => onChange(Math.floor(Math.random() * 9999) + 1)}
          className="text-[11px] px-1.5 py-0.5 border border-neutral-200 rounded hover:bg-neutral-50"
          title="Losowy seed"
        >
          🎲
        </button>
      </div>
    </div>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function TextInput({ label, value, onChange, placeholder }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-mono text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xs border border-neutral-200 rounded px-2 py-1 w-full"
      />
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-neutral-500">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-5 h-5 flex items-center justify-center border border-neutral-200 rounded text-xs hover:bg-neutral-50"
        >−</button>
        <span className="w-6 text-center text-[11px] font-mono">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-5 h-5 flex items-center justify-center border border-neutral-200 rounded text-xs hover:bg-neutral-50"
        >+</button>
      </div>
    </div>
  );
}

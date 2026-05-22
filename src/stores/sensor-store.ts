import { create } from 'zustand';

type SensorState = {
  heading: number | null;
  pressure: number | null;
  pitch: number | null;
  roll: number | null;
  steps: number | null;
  lux: number | null;
  setHeading: (heading: number | null) => void;
  setPressure: (pressure: number | null) => void;
  setLevel: (pitch: number | null, roll: number | null) => void;
  setSteps: (steps: number | null) => void;
  setLux: (lux: number | null) => void;
};

export const useSensorStore = create<SensorState>((set) => ({
  heading: null,
  pressure: null,
  pitch: null,
  roll: null,
  steps: null,
  lux: null,
  setHeading: (heading) => set({ heading }),
  setPressure: (pressure) => set({ pressure }),
  setLevel: (pitch, roll) => set({ pitch, roll }),
  setSteps: (steps) => set({ steps }),
  setLux: (lux) => set({ lux }),
}));

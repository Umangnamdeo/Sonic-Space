# 🪐 Sonic Space

**Sonic Space** is an interactive, browser-based 3D spatial audio playground and mixing console built with the modern Web Audio API. It allows producers, sound designers, and developers to position audio sources in virtual acoustic environments with real-time analog EQ, spatial panning, and room reverb modeling.

🔗 **Live Demo:** [https://umangnamdeo.github.io/Sonic-Space/](https://umangnamdeo.github.io/Sonic-Space/)[cite: 1, 2]

---

## 📸 Preview

<img width="1347" height="711" alt="screenshot" src="https://github.com/user-attachments/assets/fcc045d9-b57a-4261-a8a9-97000c24ca24" />


---

## ✨ Features

### 🎧 3D Spatial Audio & Positioning
* **Interactive Polar Soundstage:** Drag and place audio sources dynamically around a central listener across a 4-meter radius.
* **Azimuth, Distance & Elevation Controls:** Real-time feedback for angle ($\theta^\circ$), distance ($m$), and $Z$-axis elevation ($\pm Z$).
* **HRTF Panning:** Natural spatial depth and directional perception driven by Web Audio spatial panner nodes.

### 🎚️ Analog EQ & Preamp Section
* **Input Gain Control:** Clean pre-stage gain staging with decibel readouts.
* **3-Band Parametric Equalizer:**
  * **Low Shelf:** Punch and sub-bass shaping ($\pm\text{dB}$).
  * **Sweepable Mid:** Dedicated frequency sweep ($200\text{ Hz} - 5\text{ kHz}$) and gain control.
  * **High Shelf:** Air and presence tone adjustment ($\pm\text{dB}$).

### 🏛️ Acoustic Space & Reverb Engine
* **Acoustic Environment Presets:** Instant acoustic profiles:
  * `Control` · `Symphonic` · `Gothic` · `Concrete` · `Vintage` · `Anechoic`
* **Fine-Tuning Controls:**
  * **RT60 Decay:** Acoustic decay time adjustment ($s$)[cite: 1, 2].
  * **Room Size:** Virtual acoustic chamber dimensions ($m$)[cite: 1, 2].
  * **Reflections:** Early reflection density percentage[cite: 1, 2].
  * **Reverb Mix:** Dry/Wet balance control[cite: 1, 2].

### 🎵 Playback & File Support
* **Multi-Format Audio Loader:** Supports drag-and-drop or file upload for `WAV`, `MP3`, `FLAC`, `OGG`, and `M4A` (up to 60 MB)[cite: 1, 2].
* **Built-in Presets:** Quick auditioning with bundled sample audio tracks[cite: 1, 2].
* **Transport Controls:** Play/Pause, Loop toggle, Return-to-zero, and high-precision timeline scrubber[cite: 1, 2].

---

## 🛠️ Tech Stack

* **Audio Core:** Web Audio API (`AudioContext`, `PannerNode`, `BiquadFilterNode`, `ConvolverNode` / algorithmic reverb)[cite: 1, 2]
* **Frontend:** HTML5 / CSS3 / Modern JavaScript (ESNext) / TypeScript[cite: 1, 2]
* **UI & Visuals:** HTML5 Canvas / SVG for polar coordinate radar & analog dials[cite: 1, 2]
* **Deployment:** GitHub Pages[cite: 1, 2]

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/umangnamdeo/Sonic-Space.git](https://github.com/umangnamdeo/Sonic-Space.git)
cd Sonic-Space

## 🛠️ Tech Stack

* **Audio Core:** Web Audio API (`AudioContext`, `PannerNode`, `BiquadFilterNode`, `ConvolverNode` / algorithmic reverb)[cite: 1]
* **Frontend:** HTML5 / CSS3 / Modern JavaScript (ESNext) / TypeScript[cite: 1]
* **UI & Visuals:** HTML5 Canvas / SVG for polar coordinate radar & analog dials[cite: 1]
* **Deployment:** GitHub Pages[cite: 1]

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/umangnamdeo/Sonic-Space.git](https://github.com/umangnamdeo/Sonic-Space.git)
cd Sonic-Space


### 2. Run locally

Since the Web Audio API requires local file serving for security (CORS), open the project with any local development server:

**Using Python:**

```bash
python3 -m http.server 8080

```

**Using Node / `npx live-server`:**

```bash
npx live-server

```

**Using VS Code:**
Install the **Live Server** extension and click **"Go Live"** in the bottom status bar.

### 3. Open in Browser

Visit `http://localhost:8080` in Chrome, Firefox, Safari, or Edge. *(Headphones recommended for true binaural 3D effect)*.

---

## 🕹️ How to Use

1. **Load Sound:** Drag and drop an audio file onto the drop zone or audition with the built-in demo track.


2. **Hit Play:** Start playback using the transport controls at the top.


3. **Position Source:**
* Drag the orange emitter node around the concentric radar to change azimuth and distance.


* Adjust the vertical **UP / DOWN** slider on the right of the radar to modify sound height ($Z$).




4. **Tone & EQ:** Tweak the analog dials to shape the frequency spectrum.


5. **Set the Atmosphere:** Select a room preset (`Symphonic`, `Gothic`, `Concrete`, etc.) and adjust the **RT60 Decay** and **Reverb Mix** to fit the space.



---

## 📄 License

This project is open-source and available under the [MIT License](https://www.google.com/search?q=LICENSE).

```

```

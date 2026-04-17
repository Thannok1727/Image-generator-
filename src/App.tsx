import { GoogleGenAI } from "@google/genai";
import { 
  Download, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  Wand2,
  RefreshCw,
  Trash2,
  Monitor,
  Smartphone,
  Square,
  Maximize2,
  Edit2,
  X,
  Check,
  Sun,
  Contrast,
  RotateCcw,
  Layers,
  Eraser
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import { removeBackground } from "@imgly/background-removal";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

type AspectRatio = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [error, setError] = useState<string | null>(null);
  
  // Editor State
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("lumina_history");
    if (saved) {
      try {
        setImages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("lumina_history", JSON.stringify(images));
  }, [images]);

  const scrollToBottom = () => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Expand this simple image prompt into a highly detailed, artistic masterpiece description. Focus on lighting, texture, style, and mood. Keep it under 100 words. Prompt: "${prompt}"`,
      });
      const enhanced = response.text;
      if (enhanced) {
        setPrompt(enhanced.trim());
      }
    } catch (err) {
      console.error(err);
      setError("Failed to enhance prompt. Check your connection.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio,
          },
        },
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: imageUrl,
          prompt,
          timestamp: Date.now(),
        };
        setImages((prev) => [newImage, ...prev]);
        setTimeout(scrollToBottom, 500);
      } else {
        throw new Error("No image data received");
      }
    } catch (err) {
      console.error(err);
      setError("Generation failed. Please try a different prompt or check your API limit.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const upscaleImage = async (image: GeneratedImage) => {
    setIsUpscaling(true);
    setError(null);
    try {
      // Use gemini-2.5-flash-image for "free" upscaling (reliable in this environment)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            { inlineData: { data: image.url.split(",")[1], mimeType: "image/png" } },
            { text: "Take this image and refine every pixel. Make it sharper, remove artifacts, and enhance the details while strictly preserving the original composition and subject. Output as a high-quality finished work." }
          ],
        },
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        const upscaledImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: imageUrl,
          prompt: `[Enhanced] ${image.prompt}`,
          timestamp: Date.now(),
        };
        setImages((prev) => [upscaledImage, ...prev]);
        setEditingImage(null);
      } else {
        throw new Error("No image data received");
      }
    } catch (err) {
      console.error(err);
      setError("Enhancement failed. Please try again or check your API limit.");
    } finally {
      setIsUpscaling(false);
    }
  };

  const removeBgAction = async () => {
    if (!editingImage) return;
    setIsRemovingBg(true);
    setError(null);
    try {
      const blob = await (await fetch(editingImage.url)).blob();
      const resultBlob = await removeBackground(blob);
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultUrl = reader.result as string;
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: resultUrl,
          prompt: `[No Background] ${editingImage.prompt}`,
          timestamp: Date.now(),
        };
        setImages((prev) => [newImage, ...prev]);
        setEditingImage(null);
        setIsRemovingBg(false);
      };
      reader.readAsDataURL(resultBlob);
    } catch (err) {
      console.error(err);
      setError("Background removal failed. It runs entirely in your browser and might be heavy for some devices.");
      setIsRemovingBg(false);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any, brightness: number, contrast: number) => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL("image/png");
  };

  const saveEdit = async () => {
    if (!editingImage || !croppedAreaPixels) return;
    try {
      const croppedImageUrl = await getCroppedImg(
        editingImage.url,
        croppedAreaPixels,
        brightness,
        contrast
      );
      if (croppedImageUrl) {
        const editedImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: croppedImageUrl,
          prompt: `[Edited] ${editingImage.prompt}`,
          timestamp: Date.now(),
        };
        setImages((prev) => [editedImage, ...prev]);
        setEditingImage(null);
      }
    } catch (e) {
      console.error("Save failed", e);
      setError("Failed to save edited image.");
    }
  };

  const clearHistory = () => {
    if (confirm("Clear all generated images?")) {
      setImages([]);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col">
      <header className="h-[72px] px-10 flex items-center justify-between border-b border-brand-border bg-brand-surface sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[18px] font-extrabold tracking-[-0.02em]">LUMINA.API</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex px-3 py-1.5 bg-slate-100 rounded-full text-[12px] font-semibold text-brand-muted border border-brand-border">
            {images.length} Creations
          </div>
          {images.length > 0 && (
            <button 
              onClick={clearHistory}
              className="p-2 text-brand-muted hover:text-red-500 transition-colors"
              title="Clear History"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row bg-brand-border overflow-hidden lg:h-[calc(100vh-72px)]">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[360px] bg-brand-surface p-8 space-y-8 flex flex-col border-r border-brand-border overflow-y-auto">
          <div className="space-y-3">
            <label className="text-[12px] font-bold uppercase tracking-widest text-brand-muted">Input Prompt</label>
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A minimalist ceramic vase with dried pampas grass..."
                className="w-full h-[180px] p-4 bg-brand-bg border border-brand-border rounded-xl text-[14px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-accent transition-all resize-none placeholder:text-slate-400"
              />
              <button
                onClick={enhancePrompt}
                disabled={isEnhancing || !prompt.trim() || isGenerating}
                className="absolute bottom-3 right-3 p-2 bg-brand-surface hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-all border border-brand-border flex items-center gap-2 group/wand"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-muted" />
                ) : (
                  <Wand2 className="w-4 h-4 text-brand-muted group-hover/wand:text-brand-accent transition-colors" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[12px] font-bold uppercase tracking-widest text-brand-muted">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-2">
              {(["1:1", "4:3", "3:4", "16:9", "9:16"] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2.5 px-3 rounded-lg border text-[13px] font-medium transition-all text-center flex items-center justify-center gap-2 ${
                    aspectRatio === ratio
                      ? "bg-brand-accent text-white border-brand-accent shadow-sm"
                      : "bg-brand-surface border-brand-border text-brand-text hover:border-slate-400"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs leading-relaxed">
              {error}
            </div>
          )}

          <button
            onClick={generateImage}
            disabled={isGenerating || !prompt.trim()}
            className="mt-auto w-full py-4 bg-brand-accent text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>
        </aside>

        {/* Results Area */}
        <section className="flex-1 bg-brand-bg p-6 lg:p-12 overflow-y-auto min-h-[500px]">
          {images.length === 0 && !isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto">
              <div className="w-20 h-20 bg-brand-surface border border-brand-border rounded-3xl flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-slate-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Ready to Create</h2>
                <p className="text-brand-muted text-[14px]">Enter a prompt to generate your unique image. Your creations will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="aspect-square bg-slate-200 rounded-2xl flex flex-col items-center justify-center border border-brand-border relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-200/50 to-transparent animate-pulse" />
                    <Loader2 className="w-10 h-10 text-brand-muted animate-spin relative z-10" />
                    <span className="mt-4 text-[10px] uppercase font-bold tracking-widest text-brand-muted relative z-10">Processing</span>
                  </motion.div>
                )}
                
                {images.map((img) => (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-brand-surface rounded-2xl overflow-hidden border border-brand-border hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
                  >
                    <div className="p-3">
                      <img
                        src={img.url}
                        alt={img.prompt}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-cover rounded-xl bg-slate-50"
                      />
                    </div>
                    
                    <div className="p-5 border-t border-brand-border bg-brand-surface transition-all">
                      <p className="text-[13px] text-brand-text mb-4 line-clamp-2 leading-relaxed font-medium">
                        {img.prompt}
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadImage(img.url, `lumina-${img.id}.png`)}
                            className="flex-1 h-10 bg-brand-bg text-brand-text hover:bg-slate-100 rounded-lg text-xs font-bold transition-all border border-brand-border flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingImage(img);
                              setBrightness(100);
                              setContrast(100);
                            }}
                            className="h-10 w-10 flex items-center justify-center bg-brand-bg text-brand-text hover:bg-brand-accent hover:text-white rounded-lg transition-all border border-brand-border"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => upscaleImage(img)}
                          disabled={isUpscaling}
                          className="w-full h-10 bg-slate-100 text-brand-text hover:bg-brand-accent hover:text-white disabled:opacity-50 rounded-lg text-[11px] font-bold transition-all border border-brand-border flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                          {isUpscaling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Maximize2 className="w-3 h-3" />}
                          Enhance to HD
                        </button>
                        <button
                          onClick={() => deleteImage(img.id)}
                          className="w-fit text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-widest mt-1 ml-auto"
                        >
                          Delete Creation
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <div ref={resultsEndRef} className="h-20" />
        </section>
      </main>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-brand-bg/95 backdrop-blur-md flex flex-col"
          >
            <header className="h-[72px] px-8 flex items-center justify-between border-b border-brand-border bg-brand-surface">
              <div className="flex items-center gap-3">
                <Edit2 className="w-5 h-5" />
                <h2 className="font-bold">Image Studio</h2>
              </div>
              <button 
                onClick={() => setEditingImage(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Preview Area */}
              <div className="flex-1 relative bg-brand-border overflow-hidden">
                <Cropper
                  image={editingImage.url}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  style={{
                    containerStyle: {
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`
                    }
                  }}
                />
              </div>

              {/* Tools Sidebar */}
              <aside className="w-full lg:w-[320px] bg-brand-surface border-l border-brand-border p-8 space-y-8 overflow-y-auto">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-brand-muted flex items-center gap-2">
                        <Sun className="w-3 h-3" /> Brightness
                      </label>
                      <span className="text-xs font-mono">{brightness}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" max="150" value={brightness} 
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full accent-brand-accent h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-brand-muted flex items-center gap-2">
                        <Contrast className="w-3 h-3" /> Contrast
                      </label>
                      <span className="text-xs font-mono">{contrast}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" max="150" value={contrast} 
                      onChange={(e) => setContrast(parseInt(e.target.value))}
                      className="w-full accent-brand-accent h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-brand-muted flex items-center gap-2">
                        <Maximize2 className="w-3 h-3" /> Zoom
                      </label>
                      <span className="text-xs font-mono">{zoom.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-brand-accent h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-8 border-t border-brand-border">
                  <button
                    onClick={removeBgAction}
                    disabled={isRemovingBg}
                    className="w-full py-4 bg-slate-100 border border-brand-border text-brand-text hover:bg-brand-accent hover:text-white disabled:opacity-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 mb-2"
                  >
                    {isRemovingBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eraser className="w-3 h-3" />}
                    Remove Background
                  </button>
                  <button
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setZoom(1);
                      setCrop({ x: 0, y: 0 });
                    }}
                    className="w-full py-3 bg-slate-50 border border-brand-border text-brand-muted hover:text-brand-text rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset All
                  </button>
                  <button
                    onClick={saveEdit}
                    className="w-full py-4 bg-brand-accent text-white hover:bg-slate-800 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10"
                  >
                    <Check className="w-4 h-4" />
                    Apply Changes
                  </button>
                </div>
                
                <p className="text-[10px] text-brand-muted text-center leading-relaxed">
                  Editing creates a new version of your image in your gallery.
                </p>
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


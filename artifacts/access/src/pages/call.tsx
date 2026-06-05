import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSession, useEndSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { setRemoteVideoEl, setLocalStream, startWebRTC, stopWebRTC, setOnRemoteStreamChange } from "@/lib/webrtc-slot";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";

export default function Call() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const endSession = useEndSession();
  
  // Keep fetching session to know if it ended externally
  const { data: session } = useGetSession(id, {
    query: {
      queryKey: getGetSessionQueryKey(id),
      enabled: !!id,
      refetchInterval: 3000,
    }
  });

  useEffect(() => {
    if (session?.status === "ended" || session?.status === "declined") {
      cleanupAndLeave();
    }
  }, [session?.status]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    setRemoteConnected(false);
    setOnRemoteStreamChange(setRemoteConnected);

    if (remoteVideoRef.current) {
      setRemoteVideoEl(remoteVideoRef.current);
    }

    async function startMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get local media", err);
      }
      if (id && user?.role) {
        startWebRTC(id, user.role);
      }
    }

    startMedia();

    return () => {
      setOnRemoteStreamChange(null);
      stopWebRTC();
      setRemoteVideoEl(null);
      setLocalStream(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [id, user?.role]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !cameraEnabled;
      });
      setCameraEnabled(!cameraEnabled);
    }
  };

  const cleanupAndLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocation(user?.role === "interpreter" ? "/interpreter" : "/select-language");
  };

  const handleEndCall = () => {
    endSession.mutate({ id }, {
      onSettled: () => {
        cleanupAndLeave();
      }
    });
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-black overflow-hidden relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <img src="/access-logo.png" alt="Access Logo" className="h-8 object-contain brightness-0 invert" />
        {session && (
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white/90 text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {lang === "ar" ? session.language.nameAr : session.language.name}
          </div>
        )}
      </header>

      {/* Main Remote Video Area */}
      <div className="flex-1 relative bg-zinc-900 flex items-center justify-center">
        {/* Remote Video */}
        <video 
          ref={remoteVideoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay 
          playsInline 
        />
        
        {/* Shown only while waiting for the remote participant; hidden as soon
            as the remote stream arrives (tracked in React state via the
            webrtc-slot onRemoteStreamChange callback). */}
        {!remoteConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white/50 bg-black/40 backdrop-blur-[2px]">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-white/70" />
            <p className="text-lg font-medium">{t("call.connecting")}</p>
          </div>
        )}
        
        {/* Local Video PIP */}
        <div className="absolute bottom-[100px] left-4 md:bottom-6 md:left-6 w-28 h-40 md:w-40 md:h-56 bg-zinc-800 rounded-xl overflow-hidden border border-white/20 shadow-2xl z-20 transition-transform hover:scale-105 cursor-pointer">
          <video 
            ref={localVideoRef}
            className="w-full h-full object-cover mirror"
            autoPlay 
            playsInline 
            muted 
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex justify-center items-center gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <Button 
          variant={micEnabled ? "secondary" : "destructive"} 
          size="icon" 
          onClick={toggleMic}
          className={`h-14 w-14 rounded-full ${micEnabled ? 'bg-white/20 hover:bg-white/30 text-white border border-white/10' : ''}`}
        >
          {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </Button>
        
        <Button 
          variant="destructive" 
          size="icon" 
          onClick={handleEndCall}
          className="h-16 w-16 rounded-full mx-2 shadow-lg shadow-red-500/20"
        >
          <PhoneOff className="w-7 h-7" />
        </Button>

        <Button 
          variant={cameraEnabled ? "secondary" : "destructive"} 
          size="icon" 
          onClick={toggleCamera}
          className={`h-14 w-14 rounded-full ${cameraEnabled ? 'bg-white/20 hover:bg-white/30 text-white border border-white/10' : ''}`}
        >
          {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  );
}

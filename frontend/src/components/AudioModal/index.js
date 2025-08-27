import { Button, IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { PlayArrow, Pause } from "@material-ui/icons";
import React, { useRef, useEffect, useState } from "react";
import ContactAvatar from "../ContactAvatar";
import { openApi } from "../../services/api";

const LS_NAME = 'audioMessageRate';

const useStyles = makeStyles((theme) => ({
  container: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  avatar: {
    width: 36,
    height: 36,
  },
  avatarWrap: {
    position: "relative",
    width: 36,
    height: 36,
    flex: "none",
  },
  player: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0, // permite encolher dentro do flex container
  },
  playButton: {
    padding: 6,
  },
  waveform: {
    // Ocupa somente o espaço disponível no player sem forçar expansão
    flex: "1 1 auto",
    width: "auto",
    maxWidth: "100%",
    height: 44,
    display: "block",
  },
  time: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    minWidth: 38,
    textAlign: "right",
  },
  rateOverlay: {
    position: "absolute",
    top: -6,
    left: -6,
    backgroundColor: "#6c757d",
    color: "#fff",
    borderRadius: 16,
    padding: "2px 8px",
    minWidth: 0,
    lineHeight: 1.6,
    fontWeight: 600,
    fontSize: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
    textTransform: "none",
  },
}));

const AudioModal = ({ url, contact, fromMe }) => {
  const classes = useStyles();
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const animationRef = useRef(null);
  const [audioRate, setAudioRate] = useState(parseFloat(localStorage.getItem(LS_NAME) || "1"));
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState(null);
  const peaksRef = useRef(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const decodedDurationRef = useRef(0);
  const [waveError, setWaveError] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const [containerWidth, setContainerWidth] = useState(0);

  // Aplica a taxa salva
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioRate;
    }
    localStorage.setItem(LS_NAME, audioRate);
  }, [audioRate]);

  // Mantém uma ref com os picos mais recentes para o loop de animação
  useEffect(() => {
    peaksRef.current = peaks;
  }, [peaks]);

  // Configura eventos do <audio>
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(drawProgress);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(animationRef.current);
      // redesenha estado atual parado
      drawProgress();
    };
    const onEnded = () => {
      setPlaying(false);
      cancelAnimationFrame(animationRef.current);
      drawWave(1);
    };
    const onTime = () => {
      const ct = a.currentTime || 0;
      currentTimeRef.current = ct;
      setCurrentTime(ct);
    };
    const onLoaded = () => {
      const d = a.duration || 0;
      durationRef.current = d;
      setDuration(d);
    };
    const onDurationChange = () => {
      const d = a.duration || 0;
      durationRef.current = d;
      setDuration(d);
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onDurationChange);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onDurationChange);
    };
  }, []);

  // Observa a largura do player (área útil do waveform)
  useEffect(() => {
    const target = playerRef.current;
    if (!target) return;
    let rafId;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width || 0);
        if (w && w !== containerWidth) {
          // debounce via rAF para evitar thrash
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => setContainerWidth(w));
        }
      }
    });
    ro.observe(target);
    // mede uma vez no mount
    setContainerWidth(Math.floor((target.clientWidth || 0)));
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Carrega e decodifica áudio para gerar waveform (apenas quando URL muda)
  useEffect(() => {
    let aborted = false;
    const src = isIOS ? (url || "").replace(".ogg", ".mp3") : url;
    const load = async () => {
      try {
        const { data } = await openApi.get(src, { responseType: "arraybuffer", withCredentials: false });
        // Decodifica sem depender de gesto do usuário
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        let buffer;
        if (OfflineCtx) {
          const off = new OfflineCtx(1, 1, 44100);
          buffer = await off.decodeAudioData(data);
        } else {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioCtx();
          // Mesmo se 'suspended', decodeAudioData costuma funcionar
          buffer = await ctx.decodeAudioData(data);
        }
        if (aborted) return;
        const ch = buffer.getChannelData(0);
        decodedDurationRef.current = buffer.duration || 0;
        if (!durationRef.current && buffer.duration) {
          durationRef.current = buffer.duration;
        }
        const canvas = canvasRef.current;
        const playerEl = playerRef.current;
        if (!canvas || !playerEl) return;
        const parentWidth = Math.floor(playerEl.getBoundingClientRect().width);
        const canvasCssWidth = Math.floor(canvas.clientWidth || 0);
        const width = Math.max((canvasCssWidth || containerWidth || parentWidth || 0), 1);
        // Limita quantidade de barras e garante mínimo visual
        const samples = Math.min(180, Math.max(30, Math.floor(width / 2)));
        const blockSize = Math.floor(ch.length / samples);
        const peaksArr = new Array(samples).fill(0).map((_, i) => {
          let sum = 0;
          let max = 0;
          const start = i * blockSize;
          const end = Math.min((i + 1) * blockSize, ch.length);
          for (let j = start; j < end; j++) {
            const v = Math.abs(ch[j]);
            if (v > max) max = v;
            sum += v;
          }
          return max || (sum / Math.max(1, end - start));
        });
        setPeaks(peaksArr);
        setWaveError(false);
        // Desenha imediatamente conforme posição atual (se já tiver metadata)
        const a = audioRef.current;
        const total = (a && isFinite(a.duration) && a.duration > 0) ? a.duration : (durationRef.current || decodedDurationRef.current || 0);
        const ct = (a && isFinite(a.currentTime)) ? a.currentTime : currentTimeRef.current;
        const startProg = total ? Math.max(0, Math.min(1, ct / total)) : 0;
        drawWave(startProg);
        // Se já estiver tocando, inicia animação
        if (a && !a.paused) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = requestAnimationFrame(drawProgress);
        }
      } catch (e) {
        setWaveError(true);
      }
    };
    if (url) {
      load();
    }
    return () => {
      aborted = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Redesenha no resize sem recarregar áudio
  useEffect(() => {
    const a = audioRef.current;
    const total = (a && isFinite(a.duration) && a.duration > 0) ? a.duration : (durationRef.current || decodedDurationRef.current || 0);
    const ct = (a && isFinite(a.currentTime)) ? a.currentTime : currentTimeRef.current;
    const prog = total ? Math.max(0, Math.min(1, ct / total)) : 0;
    drawWave(prog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, peaks]);

  const drawWave = (progress = 0) => {
    const canvas = canvasRef.current;
    const peaksData = peaksRef.current;
    if (!canvas || !peaksData) return;
    const dpr = window.devicePixelRatio || 1;
    // Mede a largura real do player para evitar overflow do bubble
    const playerEl = playerRef.current;
    const widthCss = Math.max(Math.floor((canvas.clientWidth || playerEl?.getBoundingClientRect().width || 0)), 1);
    const heightCss = Math.max(canvas.clientHeight || 0, 44);
    canvas.width = Math.floor(widthCss * dpr);
    canvas.height = Math.floor(heightCss * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthCss, heightCss);

    const centerY = heightCss / 2;
    const barWidth = Math.max(1, Math.floor(widthCss / peaksData.length) - 1);
    const gap = Math.max(0, Math.floor(widthCss / peaksData.length) - barWidth);
    // Garante 1 barra preta mínima para indicar início
    const playedBars = Math.max(1, Math.floor(peaksData.length * progress));

    // Base (cinza claro)
    ctx.fillStyle = "#c7c7c7";
    peaksData.forEach((v, i) => {
      const x = i * (barWidth + gap);
      const h = Math.max(2, v * (heightCss - 8));
      ctx.fillRect(x, centerY - h / 2, barWidth, h);
    });

    // Progresso (preto)
    ctx.fillStyle = "#111";
    for (let i = 0; i < playedBars; i++) {
      const x = i * (barWidth + gap);
      const v = peaksData[i];
      const h = Math.max(2, v * (heightCss - 8));
      ctx.fillRect(x, centerY - h / 2, barWidth, h);
    }
  };

  const drawProgress = () => {
    const a = audioRef.current;
    const ct = (a && isFinite(a.currentTime)) ? a.currentTime : currentTimeRef.current;
    const total = (a && isFinite(a.duration) && a.duration > 0)
      ? a.duration
      : (durationRef.current || decodedDurationRef.current || 0);
    const raw = total ? (ct / total) : 0;
    const prog = Math.max(0, Math.min(1, raw));
    drawWave(prog);
    animationRef.current = requestAnimationFrame(drawProgress);
  };

  const toggleRate = () => {
    let newRate = null;
    switch (audioRate) {
      case 0.5:
        newRate = 1;
        break;
      case 1:
        newRate = 1.5;
        break;
      case 1.5:
        newRate = 2;
        break;
      case 2:
        newRate = 0.5;
        break;
      default:
        newRate = 1;
        break;
    }
    setAudioRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
    } else {
      a.pause();
    }
  };

  const formatTime = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getAudioSource = () => {
    let sourceUrl = url;
    if (isIOS) {
      sourceUrl = (sourceUrl || "").replace(".ogg", ".mp3");
    }
    return (
      <source src={sourceUrl} type={isIOS ? "audio/mp3" : "audio/ogg"} />
    );
  };

  // Fallback nativo se não conseguir gerar waveform
  if (waveError) {
    return (
      <div className={classes.container}>
        <div className={classes.avatarWrap}>
          <ContactAvatar className={classes.avatar} contact={contact} />
          {playing && (
            <Button className={classes.rateOverlay} onClick={toggleRate}>
              {audioRate}x
            </Button>
          )}
        </div>
        <div className={classes.player} ref={playerRef}>
          <audio ref={audioRef} controls>
            {getAudioSource()}
          </audio>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.container} ref={containerRef}>
      <div className={classes.avatarWrap}>
        <ContactAvatar className={classes.avatar} contact={contact} />
        {playing && (
          <Button className={classes.rateOverlay} onClick={toggleRate}>
            {audioRate}x
          </Button>
        )}
      </div>
      <div className={classes.player} ref={playerRef}>
        <IconButton className={classes.playButton} size="small" onClick={togglePlay}>
          {playing ? <Pause /> : <PlayArrow />}
        </IconButton>
        <canvas ref={canvasRef} className={classes.waveform} />
        <span className={classes.time}>{formatTime(currentTime)}</span>
        <audio ref={audioRef} preload="metadata" style={{ display: "none" }}>
          {getAudioSource()}
        </audio>
      </div>
    </div>
  );
};

export default AudioModal;